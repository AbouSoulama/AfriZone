-- AfriZone — Seed catalogue de démo (vendeurs approuvés + produits)
-- Exécuter dans : Supabase → SQL Editor → Run
-- Mot de passe des comptes démo : DemoVendor2026!
-- Emails : demo.vendeur1@afrizone.app, demo.vendeur2@afrizone.app, demo.vendeur3@afrizone.app

create extension if not exists "pgcrypto";

do $$
declare
  uid1 uuid := 'a1111111-1111-4111-8111-111111111111';
  uid2 uuid := 'a2222222-2222-4222-8222-222222222222';
  uid3 uuid := 'a3333333-3333-4333-8333-333333333333';
  vid1 uuid := 'b1111111-1111-4111-8111-111111111111';
  vid2 uuid := 'b2222222-2222-4222-8222-222222222222';
  vid3 uuid := 'b3333333-3333-4333-8333-333333333333';
  pwd text := crypt('DemoVendor2026!', gen_salt('bf'));
begin
  -- Auth users (idempotent)
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  values
    ('00000000-0000-0000-0000-000000000000', uid1, 'authenticated', 'authenticated',
     'demo.vendeur1@afrizone.app', pwd, now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"Awa Diop","phone":"+221770000001","city":"Dakar","role":"vendeur"}',
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', uid2, 'authenticated', 'authenticated',
     'demo.vendeur2@afrizone.app', pwd, now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"Ibrahim Ouédraogo","phone":"+22670000002","city":"Ouagadougou","role":"vendeur"}',
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', uid3, 'authenticated', 'authenticated',
     'demo.vendeur3@afrizone.app', pwd, now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"Fatoumata Keita","phone":"+22370000003","city":"Bamako","role":"vendeur"}',
     now(), now(), '', '', '', '')
  on conflict (id) do nothing;

  -- Identities
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  )
  values
    (uid1, uid1, format('{"sub":"%s","email":"demo.vendeur1@afrizone.app"}', uid1)::jsonb, 'email', uid1::text, now(), now(), now()),
    (uid2, uid2, format('{"sub":"%s","email":"demo.vendeur2@afrizone.app"}', uid2)::jsonb, 'email', uid2::text, now(), now(), now()),
    (uid3, uid3, format('{"sub":"%s","email":"demo.vendeur3@afrizone.app"}', uid3)::jsonb, 'email', uid3::text, now(), now(), now())
  on conflict do nothing;

  -- Profiles (trigger may already create — upsert)
  insert into public.profiles (id, full_name, phone, email, role, city, verified)
  values
    (uid1, 'Awa Diop', '+221770000001', 'demo.vendeur1@afrizone.app', 'vendeur', 'Dakar', true),
    (uid2, 'Ibrahim Ouédraogo', '+22670000002', 'demo.vendeur2@afrizone.app', 'vendeur', 'Ouagadougou', true),
    (uid3, 'Fatoumata Keita', '+22370000003', 'demo.vendeur3@afrizone.app', 'vendeur', 'Bamako', true)
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    email = excluded.email,
    role = excluded.role,
    city = excluded.city,
    verified = true;

  -- Vendors approved
  insert into public.vendors (
    id, user_id, status, vendor_code, shop_name, shop_slug, shop_description, shop_category,
    shop_logo_url, country, city, address, rating, total_sales, approved_at
  )
  values
    (vid1, uid1, 'approved', 'SN-DAK-1001', 'TechDakar', 'techdakar-sn-dak-1001',
     'Électronique et high-tech à Dakar.', 'Électronique',
     'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=200&h=200&fit=crop',
     'SN', 'Dakar', 'Plateau, Dakar', 4.9, 12500, now()),
    (vid2, uid2, 'approved', 'BF-OUA-2002', 'BeautéNaturelle', 'beautenaturelle-bf-oua-2002',
     'Cosmétiques naturels du Burkina.', 'Beauté',
     'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=200&h=200&fit=crop',
     'BF', 'Ouagadougou', 'Ouaga 2000', 5.0, 25000, now()),
    (vid3, uid3, 'approved', 'ML-BAM-3003', 'ModeAfrique', 'modeafrique-ml-bam-3003',
     'Mode et tissus africains à Bamako.', 'Mode',
     'https://images.unsplash.com/photo-1445205170230-053b83016050?w=200&h=200&fit=crop',
     'ML', 'Bamako', 'Hamdallaye', 4.8, 8200, now())
  on conflict (id) do update set
    status = 'approved',
    shop_name = excluded.shop_name,
    approved_at = now();

  -- Products
  delete from public.products where slug like 'demo-%';

  insert into public.products (
    vendor_id, name, slug, description, category, subcategory, price, old_price, stock,
    condition, delivery_mode, images, main_image, rating, review_count, sold_count,
    is_active, is_featured, tags
  ) values
  (vid1, 'iPhone 15 Pro Max 256GB', 'demo-iphone-15-pro',
   'Smartphone Apple reconditionné grade A, garantie 6 mois.', 'Électronique', 'Smartphones',
   850000, 950000, 12, 'neuf', 'afrizone',
   array['https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&h=800&fit=crop',
   4.8, 234, 89, true, true, array['iphone','apple','smartphone']),

  (vid1, 'Smart TV Samsung 55" 4K', 'demo-samsung-tv-55',
   'Téléviseur UHD, Smart Hub, livraison AfriZone.', 'Électronique', 'TV',
   420000, 480000, 8, 'neuf', 'afrizone',
   array['https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&h=800&fit=crop',
   4.7, 89, 45, true, true, array['tv','samsung']),

  (vid1, 'Casque Gaming RGB Pro', 'demo-casque-gaming',
   'Casque filaire RGB, micro rétractable.', 'Électronique', 'Audio',
   28000, 35000, 40, 'neuf', 'vendor',
   array['https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800&h=800&fit=crop',
   4.6, 67, 120, true, false, array['gaming','audio']),

  (vid2, 'Shea Butter Bio 500g', 'demo-shea-butter',
   'Beurre de karité 100% naturel, produit au Burkina Faso.', 'Beauté', 'Soins',
   8500, null, 200, 'neuf', 'afrizone',
   array['https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=800&h=800&fit=crop',
   4.9, 412, 980, true, true, array['karite','bio']),

  (vid2, 'Huile d''argan pure 100ml', 'demo-huile-argan',
   'Huile cosmétique pressée à froid.', 'Beauté', 'Soins',
   12000, 15000, 80, 'neuf', 'vendor',
   array['https://images.unsplash.com/photo-1608248543800-baa5e3b5c5f0?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1608248543800-baa5e3b5c5f0?w=800&h=800&fit=crop',
   4.7, 156, 210, true, false, array['argan','huile']),

  (vid3, 'Boubou Brodé Traditionnel', 'demo-boubou-brode',
   'Boubou brodé main, tailles M à XXL.', 'Mode', 'Hommes',
   35000, null, 25, 'neuf', 'vendor',
   array['https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&h=800&fit=crop',
   4.9, 156, 340, true, true, array['boubou','tradition']),

  (vid3, 'Tissu Wax Premium 6 yards', 'demo-tissu-wax',
   'Wax authentique, motifs assortis.', 'Mode', 'Tissus',
   15000, null, 60, 'neuf', 'afrizone',
   array['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=800&fit=crop',
   4.8, 321, 500, true, true, array['wax','tissu']),

  (vid3, 'Sac en cuir artisanal', 'demo-sac-cuir',
   'Sac bandoulière en cuir tanné localement.', 'Mode', 'Accessoires',
   22000, 28000, 18, 'neuf', 'vendor',
   array['https://images.unsplash.com/photo-1548036328-c37ea8cec3ea?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1548036328-c37ea8cec3ea?w=800&h=800&fit=crop',
   4.5, 78, 95, true, false, array['sac','cuir']);
end $$;
