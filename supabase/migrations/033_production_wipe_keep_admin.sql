-- =============================================================================
-- AfriZone — PURGE PRODUCTION (garder uniquement l'admin)
-- =============================================================================
-- À exécuter UNE FOIS dans : Supabase → SQL Editor → Run
--
-- CONSERVÉ :
--   • Compte admin Dev SOULAMA (afrizone002@gmail.com / +226…)
--   • Plans d'abonnement (subscription_plans)
--   • Barèmes de durée (subscription_terms)
--   • Règles tarif livreur (driver_rate_rules)
--   • Paramètres plateforme (app_settings) — Resend, etc.
--
-- SUPPRIMÉ :
--   • Tous les autres comptes Auth + profils
--   • Boutiques, produits, paniers, commandes, colis
--   • Livreurs, courses, preuves, wallets
--   • Paiements, abonnements utilisateurs, pubs
--   • Avis, notifications, newsletter, logs e-mail
--   • (Storage : à vider manuellement dans Dashboard → Storage — voir bas de fichier)
--
-- ⚠ Irréversible. Faire une sauvegarde Dashboard → Database → Backups si besoin.
--
-- NOTE : Supabase interdit `DELETE FROM storage.objects` (trigger protect_delete).
--        Les buckets se vident dans l’UI Storage, pas en SQL.
-- =============================================================================

do $$
declare
  v_admin_id uuid;
  v_admin_email text := 'afrizone002@gmail.com';
  v_deleted_users int := 0;
begin
  -- 1) Localiser l'admin (email Auth, email profil, ou rôle admin)
  select u.id
    into v_admin_id
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(coalesce(u.email, '')) = lower(v_admin_email)
     or lower(coalesce(p.email, '')) = lower(v_admin_email)
     or p.role = 'admin'
  order by
    case when lower(coalesce(u.email, '')) = lower(v_admin_email) then 0 else 1 end,
    case when p.role = 'admin' then 0 else 1 end
  limit 1;

  if v_admin_id is null then
    raise exception
      'ABORT: admin % introuvable. Aucune donnée n''a été supprimée.',
      v_admin_email;
  end if;

  -- Garantir le rôle admin + identité
  update public.profiles
  set
    role = 'admin',
    full_name = coalesce(nullif(trim(full_name), ''), 'Dev SOULAMA'),
    email = coalesce(nullif(trim(email), ''), v_admin_email),
    updated_at = now()
  where id = v_admin_id;

  raise notice 'Admin conservé : % (%)', v_admin_id, v_admin_email;

  -- 2) Données transactionnelles / métier (ordre FK-safe)
  -- Codes arrivée → livraisons → lots
  delete from public.delivery_arrival_codes;
  delete from public.delivery_location_logs;
  delete from public.driver_earnings;
  delete from public.driver_wallet_ledger;
  delete from public.driver_withdrawal_requests;
  delete from public.driver_payout_accounts;
  delete from public.deliveries;
  delete from public.delivery_batches;

  delete from public.reviews;
  delete from public.order_items;
  delete from public.orders;
  delete from public.payment_intents;
  delete from public.parcel_shipments;

  delete from public.cart_items;
  delete from public.carts;
  delete from public.addresses;

  delete from public.ad_placements;
  delete from public.subscriptions;

  delete from public.notifications;
  delete from public.email_logs;
  delete from public.newsletter_subscribers;

  delete from public.products;
  delete from public.vendors;
  delete from public.drivers;

  -- 3) Profils hors admin (auth.users cascade aussi, mais on nettoie d'abord le public)
  delete from public.profiles
  where id is distinct from v_admin_id;

  -- 4) Comptes Auth hors admin
  delete from auth.users
  where id is distinct from v_admin_id;
  get diagnostics v_deleted_users = row_count;

  raise notice 'Purge OK — auth.users supprimés: %. Videz ensuite les buckets Storage dans le Dashboard.',
    v_deleted_users;
end $$;

-- Contrôle rapide après purge
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.vendors) as vendors,
  (select count(*) from public.products) as products,
  (select count(*) from public.orders) as orders,
  (select count(*) from public.drivers) as drivers,
  (select count(*) from public.subscriptions) as subscriptions;

select id, full_name, email, phone, role
from public.profiles;

-- =============================================================================
-- Après succès du SQL ci-dessus : vider les fichiers (Dashboard → Storage)
-- =============================================================================
-- Pour chaque bucket : product-images, avatars, vendor-documents, delivery-proofs, Avatar
--   → ouvrir le bucket → sélectionner tous les fichiers / dossiers → Delete
-- (Supabase bloque la suppression SQL directe de storage.objects)
