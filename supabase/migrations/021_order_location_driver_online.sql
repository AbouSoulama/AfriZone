-- AfriZone — Localisation client à la commande + présence livreur (en ligne)

-- ─────────────────────────────────────────────
-- COMMANDES : GPS livraison client
-- ─────────────────────────────────────────────
alter table public.orders
  add column if not exists shipping_lat double precision,
  add column if not exists shipping_lng double precision;

comment on column public.orders.shipping_lat is 'Latitude GPS du point de livraison client (optionnel)';
comment on column public.orders.shipping_lng is 'Longitude GPS du point de livraison client (optionnel)';

-- Adresses enregistrées (réutilisation au checkout)
alter table public.addresses
  add column if not exists lat double precision,
  add column if not exists lng double precision;

-- ─────────────────────────────────────────────
-- LIVREURS : présence en ligne / hors ligne
-- ─────────────────────────────────────────────
alter table public.drivers
  add column if not exists is_online boolean not null default false,
  add column if not exists online_updated_at timestamptz;

create index if not exists drivers_is_online_idx
  on public.drivers (is_online, online_updated_at desc);

-- RPC : le livreur met à jour sa présence (RLS owner)
create or replace function public.set_driver_online(p_online boolean)
returns public.drivers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver public.drivers;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  update public.drivers
  set
    is_online = coalesce(p_online, false),
    online_updated_at = now(),
    updated_at = now()
  where user_id = auth.uid()
  returning * into v_driver;

  if v_driver.id is null then
    raise exception 'Profil livreur introuvable';
  end if;

  return v_driver;
end;
$$;

grant execute on function public.set_driver_online(boolean) to authenticated;

-- Quand le livreur pousse sa position GPS sur une course, rafraîchir aussi la présence
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
    join public.drivers d on d.id = del.driver_id
    where del.id = p_delivery_id
      and d.user_id = v_uid
      and del.status in ('accepted', 'picked_up', 'in_transit')
  ) into v_ok;

  if not v_ok and not public.is_admin() then
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
    last_location_at = now(),
    is_online = true,
    online_updated_at = now(),
    updated_at = now()
  from public.deliveries del
  where del.id = p_delivery_id and d.id = del.driver_id;

  insert into public.delivery_location_logs (delivery_id, lat, lng)
  values (p_delivery_id, p_lat, p_lng);
end;
$$;

revoke all on function public.update_delivery_location(uuid, double precision, double precision) from public;
grant execute on function public.update_delivery_location(uuid, double precision, double precision) to authenticated;
