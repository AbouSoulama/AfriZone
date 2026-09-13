-- AfriZone — Sync livreur ↔ vendeur/client + GPS vendeur restauré

-- 1) Backfill vendor_id sur courses livreur déjà assignées
update public.deliveries d
set vendor_id = o.vendor_id
from public.orders o
where d.order_id = o.id
  and d.vendor_id is null
  and o.vendor_id is not null;

-- 2) Restaurer l’auth vendeur dans update_delivery_location (cassée par 021)
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
  v_driver_id uuid;
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
        public.is_admin()
        or d.user_id = v_uid
        or (del.courier_kind = 'vendor' and v.user_id = v_uid)
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
  where id = p_delivery_id
  returning driver_id into v_driver_id;

  if v_driver_id is not null then
    update public.drivers
    set
      last_lat = p_lat,
      last_lng = p_lng,
      last_location_at = now(),
      is_online = true,
      online_updated_at = now(),
      updated_at = now()
    where id = v_driver_id;
  end if;

  insert into public.delivery_location_logs (delivery_id, lat, lng)
  values (p_delivery_id, p_lat, p_lng);
end;
$$;

revoke all on function public.update_delivery_location(uuid, double precision, double precision) from public;
grant execute on function public.update_delivery_location(uuid, double precision, double precision) to authenticated;

-- 3) S’assurer que le vendeur peut toujours lire les courses de ses commandes
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
