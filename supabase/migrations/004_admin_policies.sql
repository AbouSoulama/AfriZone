-- AfriZone — Policies admin + helper is_admin
-- Exécuter dans Supabase SQL Editor

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_approved_vendor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.vendors
    where user_id = auth.uid() and status = 'approved'
  );
$$;

-- Vendors : lecture étendue pour admin
drop policy if exists "Approved vendors are public" on public.vendors;
create policy "Vendors readable by public owner or admin"
  on public.vendors for select
  using (
    status = 'approved'
    or auth.uid() = user_id
    or public.is_admin()
  );

drop policy if exists "Vendors can update own shop" on public.vendors;
create policy "Vendors or admin can update vendor"
  on public.vendors for update
  using (auth.uid() = user_id or public.is_admin());

-- Profiles : admin peut tout lire / mettre à jour le rôle
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Admins can update any profile"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin());

-- Compte admin de démo (mot de passe : AdminAfriZone2026!)
-- Email : admin@afrizone.app
do $$
declare
  admin_id uuid := 'c0000000-0000-4000-8000-000000000001';
  pwd text := crypt('AdminAfriZone2026!', gen_salt('bf'));
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  values (
    '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
    'admin@afrizone.app', pwd, now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin AfriZone","role":"admin","city":"Dakar"}',
    now(), now(), '', '', '', ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  )
  values (
    admin_id, admin_id,
    format('{"sub":"%s","email":"admin@afrizone.app"}', admin_id)::jsonb,
    'email', admin_id::text, now(), now(), now()
  )
  on conflict do nothing;

  insert into public.profiles (id, full_name, phone, email, role, city, verified)
  values (admin_id, 'Admin AfriZone', '+221770000000', 'admin@afrizone.app', 'admin', 'Dakar', true)
  on conflict (id) do update set role = 'admin', verified = true, full_name = excluded.full_name;
end $$;
