-- AfriZone Module 8 — Livreurs + courses (deliveries)
-- Exécuter dans Supabase SQL Editor

create type public.delivery_job_status as enum (
  'assigned',
  'accepted',
  'picked_up',
  'in_transit',
  'delivered',
  'refused',
  'cancelled'
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  status public.vendor_status not null default 'pending',
  driver_code text not null unique,
  vehicle_type text not null,
  vehicle_plate text,
  city text not null,
  country text not null default 'SN',
  zones text[] not null default '{}',
  id_document_url text,
  id_document_type text,
  license_number text,
  rating numeric(3,2) not null default 0,
  total_deliveries int not null default 0,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drivers_status_idx on public.drivers(status);
create index if not exists drivers_city_idx on public.drivers(city);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  parcel_id uuid references public.parcel_shipments(id) on delete set null,
  status public.delivery_job_status not null default 'assigned',
  pickup_address text not null,
  pickup_city text not null,
  delivery_address text not null,
  delivery_city text not null,
  recipient_name text,
  recipient_phone text,
  notes text,
  assigned_by uuid references public.profiles(id),
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deliveries_one_target check (
    (order_id is not null and parcel_id is null)
    or (order_id is null and parcel_id is not null)
  )
);

create index if not exists deliveries_driver_id_idx on public.deliveries(driver_id);
create index if not exists deliveries_status_idx on public.deliveries(status);
create index if not exists deliveries_order_id_idx on public.deliveries(order_id);
create index if not exists deliveries_parcel_id_idx on public.deliveries(parcel_id);

drop trigger if exists drivers_updated_at on public.drivers;
create trigger drivers_updated_at
  before update on public.drivers
  for each row execute function public.set_updated_at();

drop trigger if exists deliveries_updated_at on public.deliveries;
create trigger deliveries_updated_at
  before update on public.deliveries
  for each row execute function public.set_updated_at();

create or replace function public.is_approved_driver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.drivers
    where user_id = auth.uid() and status = 'approved'
  );
$$;

alter table public.drivers enable row level security;
alter table public.deliveries enable row level security;

drop policy if exists "Drivers readable by owner or admin" on public.drivers;
create policy "Drivers readable by owner or admin"
  on public.drivers for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users insert own driver application" on public.drivers;
create policy "Users insert own driver application"
  on public.drivers for insert
  with check (auth.uid() = user_id);

drop policy if exists "Drivers or admin update driver" on public.drivers;
create policy "Drivers or admin update driver"
  on public.drivers for update
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Deliveries readable by driver or admin" on public.deliveries;
create policy "Deliveries readable by driver or admin"
  on public.deliveries for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.drivers d
      where d.id = deliveries.driver_id and d.user_id = auth.uid()
    )
  );

drop policy if exists "Admin insert deliveries" on public.deliveries;
create policy "Admin insert deliveries"
  on public.deliveries for insert
  with check (public.is_admin());

drop policy if exists "Driver or admin update deliveries" on public.deliveries;
create policy "Driver or admin update deliveries"
  on public.deliveries for update
  using (
    public.is_admin()
    or exists (
      select 1 from public.drivers d
      where d.id = deliveries.driver_id and d.user_id = auth.uid()
    )
  );

-- Incrémenter compteur livreur à la livraison
create or replace function public.bump_driver_on_delivered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'delivered' and (old.status is distinct from 'delivered') then
    update public.drivers
    set total_deliveries = total_deliveries + 1
    where id = new.driver_id;
  end if;
  return new;
end;
$$;

drop trigger if exists deliveries_bump_driver on public.deliveries;
create trigger deliveries_bump_driver
  after update of status on public.deliveries
  for each row execute function public.bump_driver_on_delivered();

-- Admin : voir toutes les commandes (assignation)
drop policy if exists "Admins view all orders" on public.orders;
create policy "Admins view all orders"
  on public.orders for select
  using (public.is_admin());

-- Livreurs : voir / maj commandes liées à leurs courses
drop policy if exists "Drivers view assigned orders" on public.orders;
create policy "Drivers view assigned orders"
  on public.orders for select
  using (
    exists (
      select 1 from public.deliveries del
      join public.drivers d on d.id = del.driver_id
      where del.order_id = orders.id and d.user_id = auth.uid()
    )
  );

drop policy if exists "Drivers update assigned orders" on public.orders;
create policy "Drivers update assigned orders"
  on public.orders for update
  using (
    exists (
      select 1 from public.deliveries del
      join public.drivers d on d.id = del.driver_id
      where del.order_id = orders.id
        and d.user_id = auth.uid()
        and del.status not in ('refused', 'cancelled')
    )
  );

-- Livreurs : voir / maj colis liés à leurs courses
drop policy if exists "Drivers view assigned parcels" on public.parcel_shipments;
create policy "Drivers view assigned parcels"
  on public.parcel_shipments for select
  using (
    exists (
      select 1 from public.deliveries del
      join public.drivers d on d.id = del.driver_id
      where del.parcel_id = parcel_shipments.id and d.user_id = auth.uid()
    )
  );

drop policy if exists "Drivers update assigned parcels" on public.parcel_shipments;
create policy "Drivers update assigned parcels"
  on public.parcel_shipments for update
  using (
    exists (
      select 1 from public.deliveries del
      join public.drivers d on d.id = del.driver_id
      where del.parcel_id = parcel_shipments.id
        and d.user_id = auth.uid()
        and del.status not in ('refused', 'cancelled')
    )
  );
