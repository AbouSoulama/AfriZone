-- AfriZone 034 — Champs produit par catégorie (taille, couleur, pointure, marque, modèle…)
--                + choix du client (taille / couleur / pointure) conservé dans panier et commande.
--
-- À exécuter UNE fois dans Supabase (SQL Editor). Idempotent : peut être relancé sans risque.

-- ─── 1) Fiche produit : champs spécifiques à la catégorie ───────────────
-- Exemple : {"brand":"Nike","sizes":["M","L"],"colors":["Noir","Rouge"],"material":"Coton"}
alter table public.products
  add column if not exists attributes jsonb not null default '{}'::jsonb;

comment on column public.products.attributes is
  'Champs propres à la catégorie : marque, modèle, type, tailles, couleurs, pointures, matière…';

create index if not exists products_attributes_gin_idx
  on public.products using gin (attributes jsonb_path_ops);

-- ─── 2) Choix du client conservé dans le panier et la commande ──────────
-- Exemple : {"Taille":"M","Couleur":"Noir"} (libellés lisibles, figés à la commande)
alter table public.cart_items
  add column if not exists selected_options jsonb not null default '{}'::jsonb;

alter table public.order_items
  add column if not exists selected_options jsonb not null default '{}'::jsonb;

comment on column public.cart_items.selected_options is
  'Options choisies par le client (taille, couleur, pointure…)';
comment on column public.order_items.selected_options is
  'Options choisies par le client à la commande — visibles du vendeur et de l''admin';

-- ─── 3) Une même référence peut figurer plusieurs fois au panier ────────
-- (ex. même basket en 41 noir ET en 42 blanc) : on retire l'unicité (cart_id, product_id).
-- La fusion des lignes identiques (mêmes options) est gérée par l'application.
do $$
declare
  cname text;
begin
  for cname in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.cart_items'::regclass
      and c.contype = 'u'
  loop
    execute format('alter table public.cart_items drop constraint %I', cname);
  end loop;
end $$;

create index if not exists cart_items_cart_product_idx
  on public.cart_items (cart_id, product_id);
