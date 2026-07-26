-- AfriZone — Fix RLS : recursion infinie orders ↔ deliveries
-- Exécuter dans Supabase SQL Editor

-- Helpers SECURITY DEFINER (contournent RLS → plus de boucle)

create or replace function public.user_owns_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orders
    where id = p_order_id and user_id = auth.uid()
  );
$$;

create or replace function public.user_owns_parcel(p_parcel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.parcel_shipments
    where id = p_parcel_id and user_id = auth.uid()
  );
$$;

create or replace function public.driver_assigned_to_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.deliveries del
    join public.drivers d on d.id = del.driver_id
    where del.order_id = p_order_id
      and d.user_id = auth.uid()
  );
$$;

create or replace function public.is_delivery_driver(p_delivery_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.deliveries del
    join public.drivers d on d.id = del.driver_id
    where del.id = p_delivery_id
      and d.user_id = auth.uid()
  );
$$;

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
    left join public.orders o on o.id = del.order_id
    left join public.parcel_shipments p on p.id = del.parcel_id
    where del.id = p_delivery_id
      and (
        public.is_admin()
        or d.user_id = auth.uid()
        or o.user_id = auth.uid()
        or p.user_id = auth.uid()
      )
  );
$$;

revoke all on function public.user_owns_order(uuid) from public;
revoke all on function public.user_owns_parcel(uuid) from public;
revoke all on function public.driver_assigned_to_order(uuid) from public;
revoke all on function public.is_delivery_driver(uuid) from public;
revoke all on function public.can_read_delivery(uuid) from public;

grant execute on function public.user_owns_order(uuid) to authenticated;
grant execute on function public.user_owns_parcel(uuid) to authenticated;
grant execute on function public.driver_assigned_to_order(uuid) to authenticated;
grant execute on function public.is_delivery_driver(uuid) to authenticated;
grant execute on function public.can_read_delivery(uuid) to authenticated;

-- ─── ORDERS : plus de sous-requête directe vers deliveries ───
drop policy if exists "Drivers view assigned orders" on public.orders;
create policy "Drivers view assigned orders"
  on public.orders for select
  using (public.driver_assigned_to_order(id));

drop policy if exists "Drivers update assigned orders" on public.orders;
create policy "Drivers update assigned orders"
  on public.orders for update
  using (public.driver_assigned_to_order(id));

-- ─── DELIVERIES : plus de sous-requête directe vers orders ───
drop policy if exists "Deliveries readable by driver or admin" on public.deliveries;
drop policy if exists "Deliveries readable by stakeholders" on public.deliveries;
create policy "Deliveries readable by stakeholders"
  on public.deliveries for select
  using (public.can_read_delivery(id));

drop policy if exists "Driver or admin update deliveries" on public.deliveries;
create policy "Driver or admin update deliveries"
  on public.deliveries for update
  using (
    public.is_admin()
    or public.is_delivery_driver(id)
  );

-- ─── LOCATION LOGS ───
drop policy if exists "Location logs readable by stakeholders" on public.delivery_location_logs;
create policy "Location logs readable by stakeholders"
  on public.delivery_location_logs for select
  using (public.can_read_delivery(delivery_id));

drop policy if exists "Drivers insert location logs" on public.delivery_location_logs;
create policy "Drivers insert location logs"
  on public.delivery_location_logs for insert
  with check (
    public.is_admin()
    or public.is_delivery_driver(delivery_id)
  );
