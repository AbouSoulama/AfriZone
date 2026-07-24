-- AfriZone Module 6 — Colis : tracking public + admin + updated_at
-- Exécuter dans Supabase SQL Editor

drop trigger if exists parcel_shipments_updated_at on public.parcel_shipments;
create trigger parcel_shipments_updated_at
  before update on public.parcel_shipments
  for each row execute function public.set_updated_at();

-- Suivi public par numéro de tracking (sans exposer toute la table)
create or replace function public.get_parcel_by_tracking(p_tracking text)
returns setof public.parcel_shipments
language sql
security definer
set search_path = public
stable
as $$
  select *
  from public.parcel_shipments
  where upper(trim(tracking_number)) = upper(trim(p_tracking))
  limit 1;
$$;

revoke all on function public.get_parcel_by_tracking(text) from public;
grant execute on function public.get_parcel_by_tracking(text) to anon, authenticated;

-- Admin : lecture / mise à jour de tous les colis
drop policy if exists "Admins manage all parcels" on public.parcel_shipments;
create policy "Admins manage all parcels"
  on public.parcel_shipments for all
  using (public.is_admin())
  with check (public.is_admin());

-- S'assurer que le propriétaire peut bien créer (WITH CHECK explicite)
drop policy if exists "Users manage own parcels" on public.parcel_shipments;
create policy "Users manage own parcels"
  on public.parcel_shipments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
