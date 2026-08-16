-- AfriZone — Livreurs de démonstration (SN / BF / ML)
-- Exécuter après 017 (ou après 008 si 017 déjà partiellement appliqué)
-- Mot de passe : DemoAfriZone2026!

create extension if not exists "pgcrypto";

do $$
declare
  -- Livreur déjà créé dans 017
  did1 uuid := 'e1111111-1111-4111-8111-111111111111';
  driver1 uuid := 'f1111111-1111-4111-8111-111111111111';

  -- Nouveaux livreurs
  did2 uuid := 'e2222222-2222-4222-8222-222222222222';
  did3 uuid := 'e3333333-3333-4333-8333-333333333333';
  did4 uuid := 'e4444444-4444-4444-8444-444444444444';
  did5 uuid := 'e5555555-5555-4555-8555-555555555555';
  driver2 uuid := 'f2222222-2222-4222-8222-222222222222';
  driver3 uuid := 'f3333333-3333-4333-8333-333333333333';
  driver4 uuid := 'f4444444-4444-4444-8444-444444444444';
  driver5 uuid := 'f5555555-5555-4555-8555-555555555555';

  pwd text := crypt('DemoAfriZone2026!', gen_salt('bf'));
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  values
    ('00000000-0000-0000-0000-000000000000', did1, 'authenticated', 'authenticated',
     'demo.livreur1@afrizone.app', pwd, now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"Ibrahima Sarr","phone":"+221770000201","city":"Dakar","role":"livreur"}',
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', did2, 'authenticated', 'authenticated',
     'demo.livreur2@afrizone.app', pwd, now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"Aissatou Diallo","phone":"+221770000202","city":"Dakar","role":"livreur"}',
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', did3, 'authenticated', 'authenticated',
     'demo.livreur3@afrizone.app', pwd, now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"Boubacar Ouédraogo","phone":"+22670000203","city":"Ouagadougou","role":"livreur"}',
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', did4, 'authenticated', 'authenticated',
     'demo.livreur4@afrizone.app', pwd, now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"Mariam Coulibaly","phone":"+22370000204","city":"Bamako","role":"livreur"}',
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', did5, 'authenticated', 'authenticated',
     'demo.livreur5@afrizone.app', pwd, now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"Ousmane Camara","phone":"+22370000205","city":"Bamako","role":"livreur"}',
     now(), now(), '', '', '', '')
  on conflict (id) do update set
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()),
    updated_at = now();

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  )
  values
    (did1, did1, format('{"sub":"%s","email":"demo.livreur1@afrizone.app"}', did1)::jsonb, 'email', did1::text, now(), now(), now()),
    (did2, did2, format('{"sub":"%s","email":"demo.livreur2@afrizone.app"}', did2)::jsonb, 'email', did2::text, now(), now(), now()),
    (did3, did3, format('{"sub":"%s","email":"demo.livreur3@afrizone.app"}', did3)::jsonb, 'email', did3::text, now(), now(), now()),
    (did4, did4, format('{"sub":"%s","email":"demo.livreur4@afrizone.app"}', did4)::jsonb, 'email', did4::text, now(), now(), now()),
    (did5, did5, format('{"sub":"%s","email":"demo.livreur5@afrizone.app"}', did5)::jsonb, 'email', did5::text, now(), now(), now())
  on conflict do nothing;

  insert into public.profiles (id, full_name, phone, email, role, city, verified)
  values
    (did1, 'Ibrahima Sarr', '+221770000201', 'demo.livreur1@afrizone.app', 'livreur', 'Dakar', true),
    (did2, 'Aissatou Diallo', '+221770000202', 'demo.livreur2@afrizone.app', 'livreur', 'Dakar', true),
    (did3, 'Boubacar Ouédraogo', '+22670000203', 'demo.livreur3@afrizone.app', 'livreur', 'Ouagadougou', true),
    (did4, 'Mariam Coulibaly', '+22370000204', 'demo.livreur4@afrizone.app', 'livreur', 'Bamako', true),
    (did5, 'Ousmane Camara', '+22370000205', 'demo.livreur5@afrizone.app', 'livreur', 'Bamako', true)
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    email = excluded.email,
    role = 'livreur',
    city = excluded.city,
    verified = true;

  insert into public.drivers (
    id, user_id, status, driver_code, vehicle_type, vehicle_plate, country, city, zones,
    rating, total_deliveries, approved_at
  )
  values
    (driver1, did1, 'approved', 'SN-DRV-9001', 'moto', 'DK-4521-A', 'SN', 'Dakar',
     array['SN', 'Dakar'], 4.8, 126, now()),
    (driver2, did2, 'approved', 'SN-DRV-9002', 'voiture', 'DK-8834-B', 'SN', 'Dakar',
     array['SN', 'Dakar', 'Thies'], 4.6, 84, now()),
    (driver3, did3, 'approved', 'BF-DRV-9003', 'moto', 'OU-2145-C', 'BF', 'Ouagadougou',
     array['BF', 'Ouagadougou'], 4.7, 97, now()),
    (driver4, did4, 'approved', 'ML-DRV-9004', 'moto', 'BM-3310-D', 'ML', 'Bamako',
     array['ML', 'Bamako'], 4.9, 152, now()),
    (driver5, did5, 'approved', 'ML-DRV-9005', 'camionnette', 'BM-7722-E', 'ML', 'Bamako',
     array['ML', 'Bamako', 'Sikasso'], 4.5, 61, now())
  on conflict (id) do update set
    status = 'approved',
    vehicle_type = excluded.vehicle_type,
    vehicle_plate = excluded.vehicle_plate,
    country = excluded.country,
    city = excluded.city,
    zones = excluded.zones,
    rating = excluded.rating,
    total_deliveries = excluded.total_deliveries,
    approved_at = now();
end $$;
