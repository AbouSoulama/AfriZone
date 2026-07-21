-- Fix: récupérer le téléphone depuis les métadonnées (inscription email)
-- + politiques Storage pour documents vendeur / logos / avatars

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, email, role, city)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Utilisateur'),
    coalesce(new.phone, new.raw_user_meta_data->>'phone'),
    coalesce(new.email, new.raw_user_meta_data->>'email'),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'client'),
    new.raw_user_meta_data->>'city'
  );
  return new;
end;
$$;

-- Buckets (idempotent)
insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('avatars', 'avatars', true),
  ('vendor-documents', 'vendor-documents', false)
on conflict (id) do nothing;

-- Avatars : lecture publique, écriture propriétaire
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Product images : lecture publique, écriture authentifiée (vendeurs)
create policy "Product images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Authenticated users can upload product images"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and auth.role() = 'authenticated'
  );

-- Vendor documents : privé, propriétaire uniquement
create policy "Vendors can upload own documents"
  on storage.objects for insert
  with check (
    bucket_id = 'vendor-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Vendors can read own documents"
  on storage.objects for select
  using (
    bucket_id = 'vendor-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
