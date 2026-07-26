-- AfriZone — Emails transactionnels commandes (payé → livré) + notifs admin
-- Prérequis : déployer Edge Function `order-emails` + secrets RESEND_API_KEY, EMAIL_HOOK_SECRET
-- Puis renseigner app_settings (voir fin de fichier)

create extension if not exists pg_net;

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  recipient text not null,
  role text not null default 'customer',
  event text not null,
  status text,
  subject text,
  success boolean not null default false,
  provider_id text,
  error text,
  mode text,
  created_at timestamptz not null default now()
);

create index if not exists email_logs_order_id_idx on public.email_logs(order_id);
create index if not exists email_logs_created_at_idx on public.email_logs(created_at desc);

alter table public.email_logs enable row level security;

drop policy if exists "Admins read email logs" on public.email_logs;
create policy "Admins read email logs"
  on public.email_logs for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "Admins manage app settings" on public.app_settings;
create policy "Admins manage app settings"
  on public.app_settings for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create or replace function public.app_setting(p_key text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select value from public.app_settings where key = p_key limit 1;
$$;

revoke all on function public.app_setting(text) from public;

create or replace function public.order_status_label(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'pending' then 'En attente'
    when 'confirmed' then 'Confirmée (payée)'
    when 'processing' then 'En préparation'
    when 'shipped' then 'En livraison'
    when 'delivered' then 'Livrée'
    when 'cancelled' then 'Annulée'
    when 'refunded' then 'Remboursée'
    else coalesce(p_status, '')
  end;
$$;

-- Notifie tous les admins (in-app)
create or replace function public.notify_admins(
  p_title text,
  p_body text,
  p_type text default 'order',
  p_link text default null,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in select id from public.profiles where role = 'admin' loop
    perform public.notify_user(r.id, p_title, p_body, p_type, p_link, p_meta);
  end loop;
end;
$$;

revoke all on function public.notify_admins(text, text, text, text, jsonb) from public;

-- Appelle l'Edge Function order-emails (async via pg_net)
create or replace function public.dispatch_order_email(
  p_order_id uuid,
  p_event text,
  p_status text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_secret text;
  v_url text;
begin
  v_base := trim(trailing '/' from coalesce(public.app_setting('supabase_url'), ''));
  v_secret := coalesce(public.app_setting('email_hook_secret'), '');

  if v_base = '' or v_secret = '' then
    raise notice 'dispatch_order_email: app_settings supabase_url / email_hook_secret manquants — email ignoré';
    return;
  end if;

  v_url := v_base || '/functions/v1/order-emails';

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-email-hook-secret', v_secret
    ),
    body := jsonb_build_object(
      'order_id', p_order_id,
      'event', p_event,
      'status', p_status
    )
  );
exception
  when others then
    raise notice 'dispatch_order_email failed: %', SQLERRM;
end;
$$;

revoke all on function public.dispatch_order_email(uuid, text, text) from public;

-- Commande créée (payée) → client + vendeur + admins + email
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
      'Paiement confirmé',
      'Votre commande ' || new.order_number || ' a été payée et confirmée.',
      'order',
      '/commandes/' || new.id::text,
      jsonb_build_object('order_id', new.id, 'status', new.status)
    );
  end if;

  perform public.notify_admins(
    'Nouvel achat',
    'Commande ' || new.order_number || ' — ' || new.total::text || ' FCFA (' ||
      public.order_status_label(new.status::text) || ')',
    'order',
    '/admin/commandes',
    jsonb_build_object('order_id', new.id, 'order_number', new.order_number, 'status', new.status)
  );

  perform public.dispatch_order_email(new.id, 'purchase', new.status::text);

  return new;
end;
$$;

drop trigger if exists orders_notify_insert on public.orders;
create trigger orders_notify_insert
  after insert on public.orders
  for each row execute function public.notify_on_order_insert();

-- Statut commande → client + admins + email (jusqu'à livré)
create or replace function public.notify_on_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  v_label := public.order_status_label(new.status::text);

  if new.user_id is not null then
    perform public.notify_user(
      new.user_id,
      'Mise à jour commande',
      'Commande ' || new.order_number || ' : ' || v_label,
      'order',
      '/commandes/' || new.id::text,
      jsonb_build_object('order_id', new.id, 'status', new.status)
    );
  end if;

  perform public.notify_admins(
    'Commande mise à jour',
    'Commande ' || new.order_number || ' → ' || v_label,
    'order',
    '/admin/commandes',
    jsonb_build_object('order_id', new.id, 'order_number', new.order_number, 'status', new.status)
  );

  -- Emails pour le parcours payé → livré (+ annulation / remboursement)
  if new.status::text in (
    'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
  ) then
    perform public.dispatch_order_email(new.id, 'status_update', new.status::text);
  end if;

  return new;
end;
$$;

drop trigger if exists orders_notify_status on public.orders;
create trigger orders_notify_status
  after update of status on public.orders
  for each row execute function public.notify_on_order_status();

-- =============================================================================
-- CONFIG À EXÉCUTER APRÈS DÉPLOIEMENT (remplace les valeurs) :
--
-- insert into public.app_settings (key, value) values
--   ('supabase_url', 'https://VOTRE_REF.supabase.co'),
--   ('email_hook_secret', 'un-secret-long-aleatoire')
-- on conflict (key) do update set value = excluded.value, updated_at = now();
--
-- Secrets Edge Function :
--   supabase secrets set RESEND_API_KEY=re_xxx EMAIL_HOOK_SECRET=un-secret-long-aleatoire APP_URL=https://votre-domaine
--   (EMAIL_FROM optionnel, ex. "AfriZone <noreply@votredomaine.com>")
-- =============================================================================
