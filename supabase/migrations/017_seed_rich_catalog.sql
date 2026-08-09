-- AfriZone — Catalogue enrichi (boutiques + produits réalistes) + comptes test
-- Exécuter dans Supabase → SQL Editor → Run (après 001→016)
--
-- Mot de passe commun des comptes démo : DemoAfriZone2026!
-- Voir aussi COMPTES_DEMO.md à la racine du projet.

create extension if not exists "pgcrypto";

do $$
declare
  -- Vendeurs existants (003)
  uid1 uuid := 'a1111111-1111-4111-8111-111111111111';
  uid2 uuid := 'a2222222-2222-4222-8222-222222222222';
  uid3 uuid := 'a3333333-3333-4333-8333-333333333333';
  vid1 uuid := 'b1111111-1111-4111-8111-111111111111';
  vid2 uuid := 'b2222222-2222-4222-8222-222222222222';
  vid3 uuid := 'b3333333-3333-4333-8333-333333333333';

  -- Nouveaux vendeurs
  uid4 uuid := 'a4444444-4444-4444-8444-444444444444';
  uid5 uuid := 'a5555555-5555-4555-8555-555555555555';
  uid6 uuid := 'a6666666-6666-4666-8666-666666666666';
  uid7 uuid := 'a7777777-7777-4777-8777-777777777777';
  uid8 uuid := 'a8888888-8888-4888-8888-888888888888';
  vid4 uuid := 'b4444444-4444-4444-8444-444444444444';
  vid5 uuid := 'b5555555-5555-4555-8555-555555555555';
  vid6 uuid := 'b6666666-6666-4666-8666-666666666666';
  vid7 uuid := 'b7777777-7777-4777-8777-777777777777';
  vid8 uuid := 'b8888888-8888-4888-8888-888888888888';

  -- Clients + livreur
  cid1 uuid := 'd1111111-1111-4111-8111-111111111111';
  cid2 uuid := 'd2222222-2222-4222-8222-222222222222';
  did1 uuid := 'e1111111-1111-4111-8111-111111111111';
  driver_row uuid := 'f1111111-1111-4111-8111-111111111111';

  pwd text := crypt('DemoAfriZone2026!', gen_salt('bf'));
begin
  -- ═══════════════════════════════════════════
  -- AUTH USERS
  -- ═══════════════════════════════════════════
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  values
    -- Vendeurs 003 (mdp unifié)
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
     now(), now(), '', '', '', ''),
    -- Nouveaux vendeurs
    ('00000000-0000-0000-0000-000000000000', uid4, 'authenticated', 'authenticated',
     'demo.maison@afrizone.app', pwd, now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"Moussa Ndiaye","phone":"+221770000004","city":"Dakar","role":"vendeur"}',
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', uid5, 'authenticated', 'authenticated',
     'demo.alimentation@afrizone.app', pwd, now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"Aminata Traoré","phone":"+22670000005","city":"Ouagadougou","role":"vendeur"}',
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', uid6, 'authenticated', 'authenticated',
     'demo.sport@afrizone.app', pwd, now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"Sékou Diallo","phone":"+22370000006","city":"Bamako","role":"vendeur"}',
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', uid7, 'authenticated', 'authenticated',
     'demo.auto@afrizone.app', pwd, now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"Cheikh Fall","phone":"+221770000007","city":"Dakar","role":"vendeur"}',
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', uid8, 'authenticated', 'authenticated',
     'demo.livres@afrizone.app', pwd, now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"Mariama Sawadogo","phone":"+22670000008","city":"Ouagadougou","role":"vendeur"}',
     now(), now(), '', '', '', ''),
    -- Clients
    ('00000000-0000-0000-0000-000000000000', cid1, 'authenticated', 'authenticated',
     'demo.client1@afrizone.app', pwd, now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"Khadija Ba","phone":"+221770000101","city":"Dakar","role":"client"}',
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', cid2, 'authenticated', 'authenticated',
     'demo.client2@afrizone.app', pwd, now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"Abdoulaye Koné","phone":"+22370000102","city":"Bamako","role":"client"}',
     now(), now(), '', '', '', ''),
    -- Livreur
    ('00000000-0000-0000-0000-000000000000', did1, 'authenticated', 'authenticated',
     'demo.livreur1@afrizone.app', pwd, now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"Ibrahima Sarr","phone":"+221770000201","city":"Dakar","role":"livreur"}',
     now(), now(), '', '', '', '')
  on conflict (id) do update set
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()),
    updated_at = now();

  -- Identities
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  )
  values
    (uid1, uid1, format('{"sub":"%s","email":"demo.vendeur1@afrizone.app"}', uid1)::jsonb, 'email', uid1::text, now(), now(), now()),
    (uid2, uid2, format('{"sub":"%s","email":"demo.vendeur2@afrizone.app"}', uid2)::jsonb, 'email', uid2::text, now(), now(), now()),
    (uid3, uid3, format('{"sub":"%s","email":"demo.vendeur3@afrizone.app"}', uid3)::jsonb, 'email', uid3::text, now(), now(), now()),
    (uid4, uid4, format('{"sub":"%s","email":"demo.maison@afrizone.app"}', uid4)::jsonb, 'email', uid4::text, now(), now(), now()),
    (uid5, uid5, format('{"sub":"%s","email":"demo.alimentation@afrizone.app"}', uid5)::jsonb, 'email', uid5::text, now(), now(), now()),
    (uid6, uid6, format('{"sub":"%s","email":"demo.sport@afrizone.app"}', uid6)::jsonb, 'email', uid6::text, now(), now(), now()),
    (uid7, uid7, format('{"sub":"%s","email":"demo.auto@afrizone.app"}', uid7)::jsonb, 'email', uid7::text, now(), now(), now()),
    (uid8, uid8, format('{"sub":"%s","email":"demo.livres@afrizone.app"}', uid8)::jsonb, 'email', uid8::text, now(), now(), now()),
    (cid1, cid1, format('{"sub":"%s","email":"demo.client1@afrizone.app"}', cid1)::jsonb, 'email', cid1::text, now(), now(), now()),
    (cid2, cid2, format('{"sub":"%s","email":"demo.client2@afrizone.app"}', cid2)::jsonb, 'email', cid2::text, now(), now(), now()),
    (did1, did1, format('{"sub":"%s","email":"demo.livreur1@afrizone.app"}', did1)::jsonb, 'email', did1::text, now(), now(), now())
  on conflict do nothing;

  -- Profiles
  insert into public.profiles (id, full_name, phone, email, role, city, verified)
  values
    (uid1, 'Awa Diop', '+221770000001', 'demo.vendeur1@afrizone.app', 'vendeur', 'Dakar', true),
    (uid2, 'Ibrahim Ouédraogo', '+22670000002', 'demo.vendeur2@afrizone.app', 'vendeur', 'Ouagadougou', true),
    (uid3, 'Fatoumata Keita', '+22370000003', 'demo.vendeur3@afrizone.app', 'vendeur', 'Bamako', true),
    (uid4, 'Moussa Ndiaye', '+221770000004', 'demo.maison@afrizone.app', 'vendeur', 'Dakar', true),
    (uid5, 'Aminata Traoré', '+22670000005', 'demo.alimentation@afrizone.app', 'vendeur', 'Ouagadougou', true),
    (uid6, 'Sékou Diallo', '+22370000006', 'demo.sport@afrizone.app', 'vendeur', 'Bamako', true),
    (uid7, 'Cheikh Fall', '+221770000007', 'demo.auto@afrizone.app', 'vendeur', 'Dakar', true),
    (uid8, 'Mariama Sawadogo', '+22670000008', 'demo.livres@afrizone.app', 'vendeur', 'Ouagadougou', true),
    (cid1, 'Khadija Ba', '+221770000101', 'demo.client1@afrizone.app', 'client', 'Dakar', true),
    (cid2, 'Abdoulaye Koné', '+22370000102', 'demo.client2@afrizone.app', 'client', 'Bamako', true),
    (did1, 'Ibrahima Sarr', '+221770000201', 'demo.livreur1@afrizone.app', 'livreur', 'Dakar', true)
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    email = excluded.email,
    role = excluded.role,
    city = excluded.city,
    verified = true;

  -- ═══════════════════════════════════════════
  -- BOUTIQUES
  -- ═══════════════════════════════════════════
  insert into public.vendors (
    id, user_id, status, vendor_code, shop_name, shop_slug, shop_description, shop_category,
    shop_logo_url, country, city, address, rating, review_count, total_sales, approved_at,
    is_gold_seller, is_top_rated
  )
  values
    (vid1, uid1, 'approved', 'SN-DAK-1001', 'TechDakar', 'techdakar-sn-dak-1001',
     'Smartphones, TV et accessoires high-tech à Dakar. Produits neufs, SAV et livraison AfriZone.',
     'Électronique',
     'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=400&fit=crop',
     'SN', 'Dakar', 'Avenue Georges Pompidou, Plateau', 4.8, 42, 1280, now(), true, true),

    (vid2, uid2, 'approved', 'BF-OUA-2002', 'BeautéNaturelle BF', 'beautenaturelle-bf-oua-2002',
     'Cosmétiques naturels du Burkina : karité, huiles et soins capillaires artisanaux.',
     'Beauté',
     'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=400&fit=crop',
     'BF', 'Ouagadougou', 'Ouaga 2000, Secteur 15', 4.9, 68, 2140, now(), true, true),

    (vid3, uid3, 'approved', 'ML-BAM-3003', 'ModeAfrique Bamako', 'modeafrique-ml-bam-3003',
     'Wax, boubous et accessoires confectionnés à Bamako. Mode africaine authentique.',
     'Mode',
     'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=400&h=400&fit=crop',
     'ML', 'Bamako', 'Hamdallaye ACI 2000', 4.7, 55, 960, now(), false, true),

    (vid4, uid4, 'approved', 'SN-DAK-4004', 'Maison Sahel', 'maison-sahel-sn-dak-4004',
     'Mobilier, décoration et art de la table pour la maison moderne à Dakar.',
     'Maison',
     'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=400&h=400&fit=crop',
     'SN', 'Dakar', 'Almadies, Route de Ngor', 4.6, 31, 540, now(), false, false),

    (vid5, uid5, 'approved', 'BF-OUA-5005', 'Saveurs du Sahel', 'saveurs-du-sahel-bf-oua-5005',
     'Épicerie fine sahélienne : céréales, épices, thés et produits locaux du Burkina.',
     'Alimentation',
     'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=400&fit=crop',
     'BF', 'Ouagadougou', 'Marché de Tanghin', 4.8, 47, 1890, now(), true, true),

    (vid6, uid6, 'approved', 'ML-BAM-6006', 'Sport Bamako Pro', 'sport-bamako-pro-ml-bam-6006',
     'Équipements sportifs, chaussures et fitness pour tous les niveaux à Bamako.',
     'Sport',
     'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=400&fit=crop',
     'ML', 'Bamako', 'Quartier du Fleuve', 4.5, 28, 420, now(), false, false),

    (vid7, uid7, 'approved', 'SN-DAK-7007', 'AutoExpress Sénégal', 'autoexpress-sn-dak-7007',
     'Pièces auto, entretien et accessoires pour véhicules légers. Stock Dakar.',
     'Auto',
     'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&h=400&fit=crop',
     'SN', 'Dakar', 'Patte d''Oie, Zone industrielle', 4.4, 22, 310, now(), false, false),

    (vid8, uid8, 'approved', 'BF-OUA-8008', 'Librairie Sahel', 'librairie-sahel-bf-oua-8008',
     'Livres scolaires, romans africains, papeterie et fournitures pour étudiants.',
     'Livres',
     'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=400&fit=crop',
     'BF', 'Ouagadougou', 'Avenue Kwame Nkrumah', 4.7, 19, 680, now(), false, true)
  on conflict (id) do update set
    status = 'approved',
    shop_name = excluded.shop_name,
    shop_description = excluded.shop_description,
    shop_category = excluded.shop_category,
    shop_logo_url = excluded.shop_logo_url,
    country = excluded.country,
    city = excluded.city,
    address = excluded.address,
    rating = excluded.rating,
    review_count = excluded.review_count,
    total_sales = excluded.total_sales,
    approved_at = now(),
    is_gold_seller = excluded.is_gold_seller,
    is_top_rated = excluded.is_top_rated;

  -- Livreur approuvé
  insert into public.drivers (
    id, user_id, status, driver_code, vehicle_type, vehicle_plate, country, city, zones,
    approved_at
  )
  values (
    driver_row, did1, 'approved', 'SN-DRV-9001', 'moto', 'DK-4521-A', 'SN', 'Dakar',
    array['SN', 'Dakar'], now()
  )
  on conflict (id) do update set status = 'approved', approved_at = now();

  -- ═══════════════════════════════════════════
  -- PRODUITS (remplace les slugs demo-*)
  -- ═══════════════════════════════════════════
  delete from public.products where slug like 'demo-%';

  insert into public.products (
    vendor_id, name, slug, description, category, subcategory, price, old_price, stock,
    condition, delivery_mode, delivery_zones, vendor_delivery_fee, weight_kg,
    images, main_image, rating, review_count, sold_count, is_active, is_featured, tags
  ) values
  -- TechDakar — Électronique
  (vid1, 'iPhone 14 128 Go — Noir', 'demo-iphone-14-128',
   'Smartphone Apple iPhone 14 128 Go, état neuf, garantie 6 mois. Batterie optimale, livré avec câble USB-C.',
   'Électronique', 'Smartphones', 620000, 690000, 9, 'neuf', 'afrizone', null, null, 0.2,
   array['https://images.unsplash.com/photo-1678652197831-2d1807054202?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1678652197831-2d1807054202?w=800&h=800&fit=crop',
   4.8, 56, 34, true, true, array['iphone','apple','smartphone']),

  (vid1, 'Écouteurs sans fil Bluetooth', 'demo-ecouteurs-bt',
   'Écouteurs intra-auriculaires Bluetooth 5.3, boîtier de charge, autonomie jusqu''à 24 h. Idéal sport et trajets.',
   'Électronique', 'Audio', 18500, 22000, 45, 'neuf', 'vendor', array['SN'], 1500, 0.1,
   array['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&h=800&fit=crop',
   4.5, 88, 210, true, true, array['audio','bluetooth']),

  (vid1, 'Ordinateur portable 15,6" 8 Go / 256 Go', 'demo-laptop-15',
   'PC portable polyvalent pour études et bureau : écran 15,6", 8 Go RAM, SSD 256 Go, Windows préinstallé.',
   'Électronique', 'Informatique', 285000, 320000, 7, 'neuf', 'afrizone', null, null, 1.8,
   array['https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&h=800&fit=crop',
   4.6, 41, 19, true, false, array['pc','laptop']),

  -- BeautéNaturelle — Beauté
  (vid2, 'Beurre de karité brut 500 g', 'demo-karite-500',
   'Beurre de karité 100 % naturel, non raffiné, issu de coopératives du Burkina Faso. Soin peau et cheveux.',
   'Beauté', 'Soins', 7500, null, 180, 'neuf', 'afrizone', null, null, 0.5,
   array['https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=800&h=800&fit=crop',
   4.9, 210, 890, true, true, array['karite','bio','soin']),

  (vid2, 'Huile de coco pressée à froid 250 ml', 'demo-huile-coco',
   'Huile de coco cosmétique pressée à froid. Hydrate cheveux et peaux sèches. Flacon verre 250 ml.',
   'Beauté', 'Soins', 5500, 6500, 95, 'neuf', 'vendor', array['BF'], 1000, 0.3,
   array['https://images.unsplash.com/photo-1474979266404-7ea003dc4cd5?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1474979266404-7ea003dc4cd5?w=800&h=800&fit=crop',
   4.7, 76, 340, true, false, array['coco','huile']),

  (vid2, 'Savon noir africain artisanal (x3)', 'demo-savon-noir',
   'Lot de 3 savons noirs artisanaux, formule traditionnelle pour nettoyage en profondeur et éclat de la peau.',
   'Beauté', 'Hygiène', 4500, null, 120, 'neuf', 'afrizone', null, null, 0.4,
   array['https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800&h=800&fit=crop',
   4.8, 132, 560, true, true, array['savon','artisanal']),

  -- ModeAfrique — Mode
  (vid3, 'Robe wax mi-longue — motifs géométriques', 'demo-robe-wax',
   'Robe mi-longue en wax premium, coupe fluide, tailles S à XL. Idéale cérémonies et sorties.',
   'Mode', 'Femmes', 28000, 32000, 22, 'neuf', 'vendor', array['ML'], 2000, 0.4,
   array['https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&h=800&fit=crop',
   4.8, 64, 145, true, true, array['wax','robe','mode']),

  (vid3, 'Tissu wax premium — 6 yards', 'demo-wax-6yards',
   'Coupon de wax authentique 6 yards, motifs assortis. Parfait pour couture sur mesure.',
   'Mode', 'Tissus', 16000, null, 50, 'neuf', 'afrizone', null, null, 0.8,
   array['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=800&fit=crop',
   4.7, 98, 420, true, true, array['wax','tissu']),

  (vid3, 'Sac bandoulière en cuir artisanal', 'demo-sac-cuir-ml',
   'Sac bandoulière en cuir tanné localement, finitions cousues main. Couleur cognac.',
   'Mode', 'Accessoires', 24500, 29000, 15, 'neuf', 'vendor', array['ML'], 1500, 0.6,
   array['https://images.unsplash.com/photo-1548036328-c9c625999426?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1548036328-c9c625999426?w=800&h=800&fit=crop',
   4.6, 37, 78, true, false, array['sac','cuir']),

  -- Maison Sahel — Maison
  (vid4, 'Canapé 2 places tissu gris', 'demo-canape-2p',
   'Canapé compact 2 places, revêtement tissu gris clair, structure bois. Livraison Dakar sur devis.',
   'Maison', 'Mobilier', 185000, 210000, 4, 'neuf', 'vendor', array['SN'], 15000, 35,
   array['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=800&fit=crop',
   4.5, 18, 12, true, true, array['canape','salon']),

  (vid4, 'Lampe de table design bois', 'demo-lampe-bois',
   'Lampe de chevet / bureau en bois naturel et abat-jour lin. Ampoule LED non fournie.',
   'Maison', 'Décoration', 22000, null, 28, 'neuf', 'afrizone', null, null, 1.2,
   array['https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&h=800&fit=crop',
   4.6, 29, 54, true, false, array['lampe','deco']),

  (vid4, 'Set de vaisselle 12 pièces', 'demo-vaisselle-12',
   'Service de table 12 pièces (assiettes plates, creuses, dessert) en céramique blanche.',
   'Maison', 'Cuisine', 35000, 42000, 16, 'neuf', 'afrizone', null, null, 4.5,
   array['https://images.unsplash.com/photo-1603199506016-b9a694b455fa?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1603199506016-b9a694b455fa?w=800&h=800&fit=crop',
   4.4, 21, 33, true, true, array['vaisselle','cuisine']),

  -- Saveurs du Sahel — Alimentation
  (vid5, 'Riz parfumé brisé — sac 25 kg', 'demo-riz-25kg',
   'Riz parfumé brisé de qualité, sac de 25 kg. Idéal familles et restaurants. Stock Ouagadougou.',
   'Alimentation', 'Céréales', 18500, null, 60, 'neuf', 'afrizone', null, null, 25,
   array['https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&h=800&fit=crop',
   4.8, 145, 720, true, true, array['riz','cereales']),

  (vid5, 'Mélange d''épices sahéliennes 200 g', 'demo-epices-sahel',
   'Mélange d''épices locales (piment, gingembre, ail, poivre) pour sauces et marinades. Sachet hermétique 200 g.',
   'Alimentation', 'Épices', 3500, 4000, 140, 'neuf', 'vendor', array['BF'], 800, 0.2,
   array['https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=800&h=800&fit=crop',
   4.9, 88, 410, true, true, array['epices','cuisine']),

  (vid5, 'Thé vert en vrac — 500 g', 'demo-the-vert',
   'Thé vert de qualité, conditionné en sachet kraft 500 g. Parfait pour l''attaya quotidienne.',
   'Alimentation', 'Boissons', 4500, null, 90, 'neuf', 'afrizone', null, null, 0.5,
   array['https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800&h=800&fit=crop',
   4.7, 52, 260, true, false, array['the','boisson']),

  -- Sport Bamako — Sport
  (vid6, 'Ballon de football taille 5', 'demo-ballon-foot',
   'Ballon de football officiel taille 5, coutures renforcées. Pour entraînement et matchs amateur.',
   'Sport', 'Football', 12000, 15000, 35, 'neuf', 'afrizone', null, null, 0.4,
   array['https://images.unsplash.com/photo-1614632537423-1e6c2e7e0aab?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1614632537423-1e6c2e7e0aab?w=800&h=800&fit=crop',
   4.6, 44, 190, true, true, array['football','ballon']),

  (vid6, 'Baskets running homme — pointure 42', 'demo-baskets-42',
   'Chaussures de running légères, semelle amortie, pointure 42. Coloris noir/blanc.',
   'Sport', 'Chaussures', 32000, 38000, 12, 'neuf', 'vendor', array['ML'], 2000, 0.8,
   array['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=800&fit=crop',
   4.5, 31, 67, true, true, array['baskets','running']),

  (vid6, 'Haltères hexagonales 5 kg (paire)', 'demo-halteres-5kg',
   'Paire d''haltères hexagonales 5 kg en caoutchouc, prise confortable. Fitness à domicile.',
   'Sport', 'Fitness', 18000, null, 20, 'neuf', 'afrizone', null, null, 10,
   array['https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&h=800&fit=crop',
   4.4, 17, 41, true, false, array['fitness','halteres']),

  -- AutoExpress — Auto
  (vid7, 'Huile moteur 5W-30 — 4 litres', 'demo-huile-moteur',
   'Huile moteur synthétique 5W-30, bidon 4 L. Compatible la plupart des véhicules essence / diesel légers.',
   'Auto', 'Entretien', 16500, 18500, 40, 'neuf', 'afrizone', null, null, 4,
   array['https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&h=800&fit=crop',
   4.5, 39, 155, true, true, array['huile','moteur']),

  (vid7, 'Chargeur allume-cigare USB double', 'demo-chargeur-auto',
   'Chargeur voiture 2 ports USB (QC 3.0), compatible smartphones et tablettes. Branchement 12 V.',
   'Auto', 'Accessoires', 6500, null, 55, 'neuf', 'vendor', array['SN'], 1000, 0.15,
   array['https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=800&h=800&fit=crop',
   4.3, 26, 98, true, false, array['usb','voiture']),

  (vid7, 'Kit nettoyage intérieur auto', 'demo-kit-nettoyage-auto',
   'Kit : spray nettoyant tableau de bord, lingettes et microfibre. Redonne de l''éclat à l''habitacle.',
   'Auto', 'Entretien', 9500, 11000, 30, 'neuf', 'afrizone', null, null, 0.7,
   array['https://images.unsplash.com/photo-1601362840469-51e4d8d58785?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?w=800&h=800&fit=crop',
   4.4, 14, 52, true, true, array['nettoyage','auto']),

  -- Librairie Sahel — Livres
  (vid8, 'Cahiers grands carreaux — lot de 10', 'demo-cahiers-10',
   'Lot de 10 cahiers 200 pages grands carreaux, couverture souple. Idéal collège et lycée.',
   'Livres', 'Papeterie', 6500, null, 100, 'neuf', 'afrizone', null, null, 1.5,
   array['https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=800&h=800&fit=crop',
   4.6, 48, 310, true, true, array['cahier','ecole']),

  (vid8, 'Roman africain — sélection best-seller', 'demo-roman-africain',
   'Roman contemporain d''auteur africain (édition poche). Lecture fluide, parfait cadeau culturel.',
   'Livres', 'Romans', 5500, 7000, 40, 'neuf', 'vendor', array['BF'], 800, 0.3,
   array['https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&h=800&fit=crop',
   4.8, 35, 120, true, true, array['roman','lecture']),

  (vid8, 'Trousse scolaire complète', 'demo-trousse-scolaire',
   'Trousse remplie : stylos, crayons, règle, gomme, taille-crayon. Prête pour la rentrée.',
   'Livres', 'Papeterie', 4500, null, 70, 'neuf', 'afrizone', null, null, 0.4,
   array['https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800&h=800&fit=crop'],
   'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800&h=800&fit=crop',
   4.5, 27, 185, true, false, array['trousse','ecole']);

end $$;
