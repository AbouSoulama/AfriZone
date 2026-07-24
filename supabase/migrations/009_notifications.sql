-- AfriZone Module 9 — Notifications in-app
-- Exécuter dans Supabase SQL Editor

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null default 'info',
  link text,
  read_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "Users view own notifications" on public.notifications;
create policy "Users view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own notifications" on public.notifications;
create policy "Users delete own notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- Insertion réservée aux fonctions security definer / admin
create or replace function public.notify_user(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_type text default 'info',
  p_link text default null,
  p_meta jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nid uuid;
begin
  if p_user_id is null then
    return null;
  end if;
  insert into public.notifications (user_id, title, body, type, link, meta)
  values (p_user_id, p_title, p_body, coalesce(p_type, 'info'), p_link, coalesce(p_meta, '{}'::jsonb))
  returning id into nid;
  return nid;
end;
$$;

revoke all on function public.notify_user(uuid, text, text, text, text, jsonb) from public;
grant execute on function public.notify_user(uuid, text, text, text, text, jsonb) to authenticated, anon;

-- Commande créée → notifie le vendeur
create or replace function public.notify_on_order_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id from public.vendors where id = new.vendor_id;
  if v_user_id is not null then
    perform public.notify_user(
      v_user_id,
      'Nouvelle commande',
      'Commande ' || new.order_number || ' — ' || new.total::text || ' FCFA',
      'order',
      '/vendeur/commandes/' || new.id::text,
      jsonb_build_object('order_id', new.id, 'order_number', new.order_number)
    );
  end if;
  if new.user_id is not null then
    perform public.notify_user(
      new.user_id,
      'Commande confirmée',
      'Votre commande ' || new.order_number || ' a été enregistrée et payée.',
      'order',
      '/commandes/' || new.id::text,
      jsonb_build_object('order_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists orders_notify_insert on public.orders;
create trigger orders_notify_insert
  after insert on public.orders
  for each row execute function public.notify_on_order_insert();

-- Statut commande → notifie le client
create or replace function public.notify_on_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.user_id is not null then
    perform public.notify_user(
      new.user_id,
      'Mise à jour commande',
      'Commande ' || new.order_number || ' : ' || new.status::text,
      'order',
      '/commandes/' || new.id::text,
      jsonb_build_object('order_id', new.id, 'status', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists orders_notify_status on public.orders;
create trigger orders_notify_status
  after update of status on public.orders
  for each row execute function public.notify_on_order_status();

-- Colis créé / statut
create or replace function public.notify_on_parcel_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    perform public.notify_user(
      new.user_id,
      'Colis enregistré',
      'Suivi ' || new.tracking_number || ' — ' || new.pickup_city || ' → ' || new.delivery_city,
      'parcel',
      '/colis/' || new.id::text,
      jsonb_build_object('parcel_id', new.id, 'tracking', new.tracking_number)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists parcels_notify_insert on public.parcel_shipments;
create trigger parcels_notify_insert
  after insert on public.parcel_shipments
  for each row execute function public.notify_on_parcel_insert();

create or replace function public.notify_on_parcel_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.user_id is not null then
    perform public.notify_user(
      new.user_id,
      'Suivi colis',
      new.tracking_number || ' : ' || new.status::text,
      'parcel',
      '/suivi?n=' || new.tracking_number,
      jsonb_build_object('parcel_id', new.id, 'status', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists parcels_notify_status on public.parcel_shipments;
create trigger parcels_notify_status
  after update of status on public.parcel_shipments
  for each row execute function public.notify_on_parcel_status();

-- Course assignée → livreur
create or replace function public.notify_on_delivery_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d_user uuid;
begin
  select user_id into d_user from public.drivers where id = new.driver_id;
  if d_user is not null then
    perform public.notify_user(
      d_user,
      'Nouvelle course',
      new.pickup_city || ' → ' || new.delivery_city,
      'delivery',
      '/livreur/courses/' || new.id::text,
      jsonb_build_object('delivery_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists deliveries_notify_insert on public.deliveries;
create trigger deliveries_notify_insert
  after insert on public.deliveries
  for each row execute function public.notify_on_delivery_insert();

-- Validation vendeur
create or replace function public.notify_on_vendor_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'approved' then
      perform public.notify_user(
        new.user_id,
        'Boutique approuvée',
        'Votre boutique « ' || new.shop_name || ' » est validée. Vous pouvez vendre.',
        'account',
        '/vendeur',
        jsonb_build_object('vendor_id', new.id, 'status', new.status)
      );
    elsif new.status = 'rejected' then
      perform public.notify_user(
        new.user_id,
        'Boutique refusée',
        coalesce(new.rejection_reason, 'Votre candidature vendeur a été refusée.'),
        'account',
        '/auth/register/vendor',
        jsonb_build_object('vendor_id', new.id, 'status', new.status)
      );
    elsif new.status = 'suspended' then
      perform public.notify_user(
        new.user_id,
        'Boutique suspendue',
        'Votre boutique a été suspendue. Contactez le support.',
        'account',
        null,
        jsonb_build_object('vendor_id', new.id)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists vendors_notify_status on public.vendors;
create trigger vendors_notify_status
  after update of status on public.vendors
  for each row execute function public.notify_on_vendor_status();

-- Validation livreur
create or replace function public.notify_on_driver_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'approved' then
      perform public.notify_user(
        new.user_id,
        'Compte livreur approuvé',
        'Votre compte ' || new.driver_code || ' est actif. Connectez-vous pour recevoir des courses.',
        'account',
        '/livreur',
        jsonb_build_object('driver_id', new.id)
      );
    elsif new.status = 'rejected' then
      perform public.notify_user(
        new.user_id,
        'Candidature livreur refusée',
        coalesce(new.rejection_reason, 'Votre candidature livreur a été refusée.'),
        'account',
        '/auth/register/driver',
        jsonb_build_object('driver_id', new.id)
      );
    elsif new.status = 'suspended' then
      perform public.notify_user(
        new.user_id,
        'Compte livreur suspendu',
        'Votre compte livreur a été suspendu.',
        'account',
        null,
        jsonb_build_object('driver_id', new.id)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists drivers_notify_status on public.drivers;
create trigger drivers_notify_status
  after update of status on public.drivers
  for each row execute function public.notify_on_driver_status();
