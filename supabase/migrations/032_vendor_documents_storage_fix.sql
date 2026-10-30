-- AfriZone — Storage vendor-documents : policies fiables pour l'inscription
-- Bucket privé (déjà existant). Ajoute UPDATE propriétaire (upsert / retry)
-- et resserre INSERT/SELECT pour le rôle authenticated.

insert into storage.buckets (id, name, public)
values ('vendor-documents', 'vendor-documents', false)
on conflict (id) do update set public = false;

-- Nettoyage des anciennes policies (noms historiques)
drop policy if exists "Vendors can upload own documents" on storage.objects;
drop policy if exists "Vendors can read own documents" on storage.objects;
drop policy if exists "Vendors can update own documents" on storage.objects;
drop policy if exists "Admins can read vendor documents" on storage.objects;

-- INSERT : le premier dossier du chemin = auth.uid()
-- chemin attendu : {userId}/identity/... ou {userId}/driver-identity/...
create policy "Vendors can upload own documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'vendor-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT propriétaire
create policy "Vendors can read own documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'vendor-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE propriétaire (nécessaire si upsert=true côté client)
create policy "Vendors can update own documents"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'vendor-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'vendor-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT admin (validation des dossiers)
create policy "Admins can read vendor documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'vendor-documents'
    and public.is_admin()
  );
