-- AfriZone — Livraison vendeur (self-delivery) + suivi GPS
-- Exécuter après 012/013/015

-- Colonne vendeur sur les courses (livreur AfriZone OU vendeur lui-même)
alter table public.deliveries
  add column if not exists vendor_id uuid references public.vendors(id) on delete set null;

alter table public.deliveries
  add column if not exists courier_kind text not null default 'driver';

-- Au cas où 015 n'a pas encore rendu driver_id nullable
alter table public.deliveries
  alter column driver_id drop not null;

create index if not exists deliveries_vendor_id_idx on public.deliveries(vendor_id);

comment on column public.deliveries.courier_kind is 'driver = livreur AfriZone ; vendor = vendeur livre lui-même';

-- Lecture course : inclure le vendeur propriétaire
create or replace function public.can_read_delivery(p_delivery_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.deliveries del
    left join public.drivers d on d.id = del.driver_id
    left join public.vendors v on v.id = del.vendor_id
    left join public.orders o on o.id = del.order_id
    left join public.parcel_shipments p on p.id = del.parcel_id
    where del.id = p_delivery_id
      and (
        public.is_admin()
        or d.user_id = auth.uid()
        or v.user_id = auth.uid()
        or o.user_id = auth.uid()
        or p.user_id = auth.uid()
        or exists (
          select 1 from public.vendors vv
          where vv.id = o.vendor_id and vv.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.is_delivery_vendor(p_delivery_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.deliveries del
    join public.vendors v on v.id = del.vendor_id
    where del.id = p_delivery_id
      and v.user_id = auth.uid()
  );
$$;

revoke all on function public.is_delivery_vendor(uuid) from public;
grant execute on function public.is_delivery_vendor(uuid) to authenticated;

-- GPS : livreur OU vendeur
create or replace function public.update_delivery_location(
  p_delivery_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ok boolean;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;

  select exists (
    select 1
    from public.deliveries del
    left join public.drivers d on d.id = del.driver_id
    left join public.vendors v on v.id = del.vendor_id
    where del.id = p_delivery_id
      and del.status in ('accepted', 'picked_up', 'in_transit')
      and (
        d.user_id = v_uid
        or v.user_id = v_uid
        or public.is_admin()
      )
  ) into v_ok;

  if not v_ok then
    raise exception 'Course introuvable ou non autorisée';
  end if;

  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Coordonnées GPS invalides';
  end if;

  update public.deliveries
  set
    current_lat = p_lat,
    current_lng = p_lng,
    location_updated_at = now()
  where id = p_delivery_id;

  update public.drivers d
  set
    last_lat = p_lat,
    last_lng = p_lng,
    last_location_at = now()
  from public.deliveries del
  where del.id = p_delivery_id and d.id = del.driver_id;

  insert into public.delivery_location_logs (delivery_id, lat, lng)
  values (p_delivery_id, p_lat, p_lng);
end;
$$;

-- Vendeur démarre une livraison « je livre moi-même »
create or replace function public.vendor_start_self_delivery(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_vendor_id uuid;
  v_order record;
  v_delivery_id uuid;
  v_tracking text;
  v_has_vendor_mode boolean;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;

  select id into v_vendor_id
  from public.vendors
  where user_id = v_uid;

  if v_vendor_id is null then
    raise exception 'Boutique introuvable';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id and vendor_id = v_vendor_id;

  if not found then
    raise exception 'Commande introuvable';
  end if;

  if v_order.status not in ('confirmed', 'processing') then
    raise exception 'La commande doit être confirmée ou en préparation';
  end if;

  -- Au moins un produit en mode livraison vendeur
  select exists (
    select 1
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
      and p.delivery_mode = 'vendor'
  ) into v_has_vendor_mode;

  if not v_has_vendor_mode then
    raise exception 'Cette commande est en livraison AfriZone — assignez un livreur via l’admin, ou changez le mode produit.';
  end if;

  -- Réutilise une course vendeur déjà créée
  select id into v_delivery_id
  from public.deliveries
  where order_id = p_order_id
    and vendor_id = v_vendor_id
    and courier_kind = 'vendor'
  order by created_at desc
  limit 1;

  if v_delivery_id is not null then
    update public.orders
    set status = 'shipped',
        tracking_number = coalesce(tracking_number, 'AZ-V-' || order_number),
        updated_at = now()
    where id = p_order_id;
    return v_delivery_id;
  end if;

  v_tracking := coalesce(v_order.tracking_number, 'AZ-V-' || v_order.order_number);

  insert into public.deliveries (
    driver_id,
    vendor_id,
    courier_kind,
    order_id,
    status,
    pickup_address,
    pickup_city,
    delivery_address,
    delivery_city,
    recipient_name,
    recipient_phone,
    notes,
    assigned_by,
    accepted_at
  )
  values (
    null,
    v_vendor_id,
    'vendor',
    p_order_id,
    'accepted',
    coalesce((select address from public.vendors where id = v_vendor_id), 'Boutique vendeur'),
    coalesce((select city from public.vendors where id = v_vendor_id), v_order.shipping_city),
    v_order.shipping_address,
    v_order.shipping_city,
    (select full_name from public.profiles where id = v_order.user_id),
    v_order.shipping_phone,
    'Livraison par le vendeur',
    v_uid,
    now()
  )
  returning id into v_delivery_id;

  update public.orders
  set
    status = 'shipped',
    tracking_number = v_tracking,
    updated_at = now()
  where id = p_order_id;

  return v_delivery_id;
end;
$$;

revoke all on function public.vendor_start_self_delivery(uuid) from public;
grant execute on function public.vendor_start_self_delivery(uuid) to authenticated;

-- Vendeur avance le statut de sa course (et synchronise la commande)
create or replace function public.vendor_update_delivery_status(
  p_delivery_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_del record;
  v_next text;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;

  select del.* into v_del
  from public.deliveries del
  join public.vendors v on v.id = del.vendor_id
  where del.id = p_delivery_id
    and v.user_id = v_uid
    and del.courier_kind = 'vendor';

  if not found then
    raise exception 'Course vendeur introuvable';
  end if;

  v_next := case v_del.status::text
    when 'assigned' then 'accepted'
    when 'accepted' then 'picked_up'
    when 'picked_up' then 'in_transit'
    when 'in_transit' then 'delivered'
    else null
  end;

  if v_next is distinct from p_status then
    raise exception 'Transition invalide : % → %', v_del.status, p_status;
  end if;

  update public.deliveries
  set
    status = p_status::public.delivery_job_status,
    accepted_at = case when p_status = 'accepted' then coalesce(accepted_at, now()) else accepted_at end,
    delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
    updated_at = now()
  where id = p_delivery_id;

  if p_status = 'delivered' and v_del.order_id is not null then
    update public.orders
    set status = 'delivered', updated_at = now()
    where id = v_del.order_id;
  elsif p_status in ('picked_up', 'in_transit') and v_del.order_id is not null then
    update public.orders
    set status = 'shipped', updated_at = now()
    where id = v_del.order_id and status is distinct from 'delivered';
  end if;
end;
$$;

revoke all on function public.vendor_update_delivery_status(uuid, text) from public;
grant execute on function public.vendor_update_delivery_status(uuid, text) to authenticated;

-- Logs GPS : vendeur peut aussi insérer
drop policy if exists "Drivers insert location logs" on public.delivery_location_logs;
create policy "Couriers insert location logs"
  on public.delivery_location_logs for insert
  with check (
    public.is_admin()
    or public.is_delivery_driver(delivery_id)
    or public.is_delivery_vendor(delivery_id)
  );
