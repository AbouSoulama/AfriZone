-- AfriZone Module 12 — Géolocalisation + Badges vendeurs
-- Exécuter dans Supabase SQL Editor (après 001→011)

-- ─────────────────────────────────────────────
-- BADGES VENDEURS
-- ─────────────────────────────────────────────
alter table public.vendors
  add column if not exists is_gold_seller boolean not null default false;

alter table public.vendors
  add column if not exists is_top_rated boolean not null default false;

-- Recalcul automatique Top Rated / Gold (seuils MVP)
create or replace function public.refresh_vendor_badges(p_vendor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rating numeric;
  v_reviews int;
  v_sales int;
begin
  select rating, coalesce(review_count, 0), coalesce(total_sales, 0)
    into v_rating, v_reviews, v_sales
  from public.vendors
  where id = p_vendor_id;

  if not found then
    return;
  end if;

  update public.vendors
  set
    is_top_rated = (coalesce(v_rating, 0) >= 4.5 and coalesce(v_reviews, 0) >= 5),
    -- Gold : ventes élevées OU déjà forcé manuellement (on ne retire pas un gold admin
    -- si ventes baissent : on active auto, on ne désactive que si pas de flag manuel via admin)
    is_gold_seller = case
      when coalesce(v_sales, 0) >= 50 then true
      else is_gold_seller
    end,
    updated_at = now()
  where id = p_vendor_id;
end;
$$;

-- Quand le rating produit/vendeur change via reviews, rafraîchir badges
create or replace function public.reviews_refresh_vendor_badges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_vendor_badges(old.vendor_id);
    return old;
  end if;
  perform public.refresh_vendor_badges(new.vendor_id);
  return new;
end;
$$;

drop trigger if exists reviews_refresh_vendor_badges on public.reviews;
create trigger reviews_refresh_vendor_badges
  after insert or update or delete on public.reviews
  for each row execute function public.reviews_refresh_vendor_badges();

-- ─────────────────────────────────────────────
-- GEOLOCALISATION LIVREURS / COURSES
-- ─────────────────────────────────────────────
alter table public.drivers
  add column if not exists last_lat double precision,
  add column if not exists last_lng double precision,
  add column if not exists last_location_at timestamptz;

alter table public.deliveries
  add column if not exists current_lat double precision,
  add column if not exists current_lng double precision,
  add column if not exists location_updated_at timestamptz,
  add column if not exists pickup_lat double precision,
  add column if not exists pickup_lng double precision,
  add column if not exists delivery_lat double precision,
  add column if not exists delivery_lng double precision,
  add column if not exists route_distance_km numeric(10,2),
  add column if not exists route_eta_minutes int;

create table if not exists public.delivery_location_logs (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  recorded_at timestamptz not null default now()
);

create index if not exists delivery_location_logs_delivery_idx
  on public.delivery_location_logs(delivery_id, recorded_at desc);

alter table public.delivery_location_logs enable row level security;

-- Client (commande / colis) + livreur + admin peuvent lire la course
drop policy if exists "Deliveries readable by driver or admin" on public.deliveries;
create policy "Deliveries readable by stakeholders"
  on public.deliveries for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.drivers d
      where d.id = deliveries.driver_id and d.user_id = auth.uid()
    )
    or exists (
      select 1 from public.orders o
      where o.id = deliveries.order_id and o.user_id = auth.uid()
    )
    or exists (
      select 1 from public.parcel_shipments p
      where p.id = deliveries.parcel_id and p.user_id = auth.uid()
    )
  );

-- Logs lisibles par les mêmes acteurs
drop policy if exists "Location logs readable by stakeholders" on public.delivery_location_logs;
create policy "Location logs readable by stakeholders"
  on public.delivery_location_logs for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.deliveries del
      join public.drivers d on d.id = del.driver_id
      where del.id = delivery_location_logs.delivery_id
        and d.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.deliveries del
      join public.orders o on o.id = del.order_id
      where del.id = delivery_location_logs.delivery_id
        and o.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.deliveries del
      join public.parcel_shipments p on p.id = del.parcel_id
      where del.id = delivery_location_logs.delivery_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "Drivers insert location logs" on public.delivery_location_logs;
create policy "Drivers insert location logs"
  on public.delivery_location_logs for insert
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.deliveries del
      join public.drivers d on d.id = del.driver_id
      where del.id = delivery_location_logs.delivery_id
        and d.user_id = auth.uid()
    )
  );

-- RPC : livreur pousse sa position
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
    last_location_at = now()
  from public.deliveries del
  where del.id = p_delivery_id and d.id = del.driver_id;

  insert into public.delivery_location_logs (delivery_id, lat, lng)
  values (p_delivery_id, p_lat, p_lng);
end;
$$;

revoke all on function public.update_delivery_location(uuid, double precision, double precision) from public;
grant execute on function public.update_delivery_location(uuid, double precision, double precision) to authenticated;

-- Seed badges pour vendeurs déjà bien notés
update public.vendors
set
  is_top_rated = (rating >= 4.5 and coalesce(review_count, 0) >= 5),
  is_gold_seller = (coalesce(total_sales, 0) >= 50 or is_gold_seller = true);

-- Realtime : suivi position livreur (client écoute les UPDATE sur deliveries)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'deliveries'
  ) then
    alter publication supabase_realtime add table public.deliveries;
  end if;
end $$;
