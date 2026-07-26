-- AfriZone — Fix suppressions admin (users, boutiques, produits, livreurs)
-- Causes fréquentes :
-- 1) order_items.product_id sans ON DELETE → bloque suppression produit/boutique
-- 2) deliveries.driver_id ON DELETE RESTRICT → bloque suppression livreur/user
-- 3) RLS : DELETE sans .select() peut « réussir » sans rien supprimer
--
-- Exécuter dans Supabase SQL Editor après 011 (et idéalement 001→014).

-- ─────────────────────────────────────────────
-- FK : order_items → products (conserver historique prix, détacher produit)
-- ─────────────────────────────────────────────
alter table public.order_items
  alter column product_id drop not null;

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.order_items'::regclass
    and contype = 'f'
    and pg_get_constraintdef(oid) ilike '%product_id%';
  if cname is not null then
    execute format('alter table public.order_items drop constraint %I', cname);
  end if;
end $$;

alter table public.order_items
  add constraint order_items_product_id_fkey
  foreign key (product_id) references public.products(id) on delete set null;

-- ─────────────────────────────────────────────
-- FK : deliveries → drivers (détacher courses si livreur supprimé)
-- ─────────────────────────────────────────────
alter table public.deliveries
  alter column driver_id drop not null;

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.deliveries'::regclass
    and contype = 'f'
    and pg_get_constraintdef(oid) ilike '%driver_id%';
  if cname is not null then
    execute format('alter table public.deliveries drop constraint %I', cname);
  end if;
end $$;

alter table public.deliveries
  add constraint deliveries_driver_id_fkey
  foreign key (driver_id) references public.drivers(id) on delete set null;

-- ─────────────────────────────────────────────
-- Policies delete admin (au cas où 011 non appliqué / incomplet)
-- ─────────────────────────────────────────────
drop policy if exists "Admins can delete profiles" on public.profiles;
create policy "Admins can delete profiles"
  on public.profiles for delete
  using (public.is_admin());

drop policy if exists "Admins can delete vendors" on public.vendors;
create policy "Admins can delete vendors"
  on public.vendors for delete
  using (public.is_admin());

drop policy if exists "Admins can delete drivers" on public.drivers;
create policy "Admins can delete drivers"
  on public.drivers for delete
  using (public.is_admin());

drop policy if exists "Admins manage cart items" on public.cart_items;
create policy "Admins manage cart items"
  on public.cart_items for all
  using (public.is_admin())
  with check (public.is_admin());

-- Produits : s'assurer que admin peut DELETE (policy FOR ALL)
drop policy if exists "Vendors or admin manage products" on public.products;
drop policy if exists "Vendors can manage own products" on public.products;
create policy "Vendors or admin manage products"
  on public.products for all
  using (
    public.is_admin()
    or exists (
      select 1 from public.vendors v
      where v.id = products.vendor_id and v.user_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.vendors v
      where v.id = products.vendor_id and v.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- RPC : supprimer un produit (bypass RLS, détache paniers)
-- ─────────────────────────────────────────────
create or replace function public.admin_delete_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'Produit introuvable';
  end if;

  delete from public.cart_items where product_id = p_product_id;
  -- order_items.product_id → SET NULL via FK
  delete from public.products where id = p_product_id;
end;
$$;

revoke all on function public.admin_delete_product(uuid) from public;
grant execute on function public.admin_delete_product(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- RPC : supprimer une boutique (+ ses produits)
-- ─────────────────────────────────────────────
create or replace function public.admin_delete_vendor(p_vendor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  if not exists (select 1 from public.vendors where id = p_vendor_id) then
    raise exception 'Boutique introuvable';
  end if;

  for r in select id from public.products where vendor_id = p_vendor_id loop
    delete from public.cart_items where product_id = r.id;
    delete from public.products where id = r.id;
  end loop;

  delete from public.vendors where id = p_vendor_id;
end;
$$;

revoke all on function public.admin_delete_vendor(uuid) from public;
grant execute on function public.admin_delete_vendor(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- RPC : supprimer un livreur
-- ─────────────────────────────────────────────
create or replace function public.admin_delete_driver(p_driver_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  if not exists (select 1 from public.drivers where id = p_driver_id) then
    raise exception 'Livreur introuvable';
  end if;

  -- courses détachées via FK ON DELETE SET NULL
  delete from public.drivers where id = p_driver_id;
end;
$$;

revoke all on function public.admin_delete_driver(uuid) from public;
grant execute on function public.admin_delete_driver(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- RPC : supprimer un utilisateur Auth + profil (amélioré)
-- ─────────────────────────────────────────────
create or replace function public.admin_delete_auth_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_driver_id uuid;
  v_vendor_id uuid;
  r record;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas supprimer votre propre compte admin';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Utilisateur introuvable';
  end if;

  -- Boutique liée
  select id into v_vendor_id from public.vendors where user_id = p_user_id;
  if v_vendor_id is not null then
    for r in select id from public.products where vendor_id = v_vendor_id loop
      delete from public.cart_items where product_id = r.id;
      delete from public.products where id = r.id;
    end loop;
    delete from public.vendors where id = v_vendor_id;
  end if;

  -- Livreur lié
  select id into v_driver_id from public.drivers where user_id = p_user_id;
  if v_driver_id is not null then
    delete from public.drivers where id = v_driver_id;
  end if;

  delete from public.profiles where id = p_user_id;
  delete from auth.identities where user_id = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.admin_delete_auth_user(uuid) from public;
grant execute on function public.admin_delete_auth_user(uuid) to authenticated;
