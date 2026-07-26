-- AfriZone Module 11+ — Gestion admin (users, boutiques, produits, docs)
-- Exécuter dans Supabase SQL Editor (après 001→010)

-- ─────────────────────────────────────────────
-- PROFILES : admin peut supprimer
-- ─────────────────────────────────────────────
drop policy if exists "Admins can delete profiles" on public.profiles;
create policy "Admins can delete profiles"
  on public.profiles for delete
  using (public.is_admin());

-- ─────────────────────────────────────────────
-- VENDORS : admin peut supprimer
-- ─────────────────────────────────────────────
drop policy if exists "Admins can delete vendors" on public.vendors;
create policy "Admins can delete vendors"
  on public.vendors for delete
  using (public.is_admin());

-- ─────────────────────────────────────────────
-- PRODUCTS : admin lecture / maj / suppression
-- ─────────────────────────────────────────────
drop policy if exists "Active products are public" on public.products;
create policy "Products readable by public owner or admin"
  on public.products for select
  using (
    is_active = true
    or exists (
      select 1 from public.vendors v
      where v.id = products.vendor_id and v.user_id = auth.uid()
    )
    or public.is_admin()
  );

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
-- DRIVERS : admin peut supprimer
-- ─────────────────────────────────────────────
drop policy if exists "Admins can delete drivers" on public.drivers;
create policy "Admins can delete drivers"
  on public.drivers for delete
  using (public.is_admin());

-- ─────────────────────────────────────────────
-- STORAGE : admin peut lire les pièces d'identité
-- ─────────────────────────────────────────────
drop policy if exists "Admins can read vendor documents" on storage.objects;
create policy "Admins can read vendor documents"
  on storage.objects for select
  using (
    bucket_id = 'vendor-documents'
    and public.is_admin()
  );

-- ─────────────────────────────────────────────
-- Helper : vérifier admin depuis Edge Function (JWT)
-- ─────────────────────────────────────────────
create or replace function public.admin_set_user_password(p_user_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;
  if p_password is null or length(trim(p_password)) < 8 then
    raise exception 'Mot de passe trop court (min. 8 caractères)';
  end if;
  -- Note: mise à jour directe auth.users (nécessite extensions pgcrypto)
  update auth.users
  set
    encrypted_password = crypt(p_password, gen_salt('bf')),
    updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'Utilisateur introuvable';
  end if;
end;
$$;

revoke all on function public.admin_set_user_password(uuid, text) from public;
grant execute on function public.admin_set_user_password(uuid, text) to authenticated;

create or replace function public.admin_delete_auth_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas supprimer votre propre compte admin';
  end if;

  -- Cascade profiles → vendors/drivers via FK
  delete from public.profiles where id = p_user_id;
  delete from auth.identities where user_id = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.admin_delete_auth_user(uuid) from public;
grant execute on function public.admin_delete_auth_user(uuid) to authenticated;
