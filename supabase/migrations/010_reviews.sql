-- AfriZone Module 10 — Avis & confiance
-- Exécuter dans Supabase SQL Editor (après 001→009)

-- ─────────────────────────────────────────────
-- TABLE REVIEWS
-- ─────────────────────────────────────────────
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  vendor_rating smallint not null check (vendor_rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id, order_id)
);

create index if not exists reviews_product_id_idx on public.reviews(product_id, created_at desc);
create index if not exists reviews_vendor_id_idx on public.reviews(vendor_id, created_at desc);
create index if not exists reviews_user_id_idx on public.reviews(user_id);
create index if not exists reviews_order_id_idx on public.reviews(order_id);

drop trigger if exists reviews_updated_at on public.reviews;
create trigger reviews_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

alter table public.reviews enable row level security;

-- Lecture publique (catalogue)
drop policy if exists "Anyone can read reviews" on public.reviews;
create policy "Anyone can read reviews"
  on public.reviews for select
  using (true);

-- Mise à jour / suppression : auteur ou admin
drop policy if exists "Users update own reviews" on public.reviews;
create policy "Users update own reviews"
  on public.reviews for update
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users delete own reviews" on public.reviews;
create policy "Users delete own reviews"
  on public.reviews for delete
  using (auth.uid() = user_id or public.is_admin());

-- Pas d'INSERT direct : passer par submit_review (validation commande livrée)

-- Compteur d'avis vendeur
alter table public.vendors
  add column if not exists review_count int not null default 0;

-- ─────────────────────────────────────────────
-- RECALCUL RATINGS
-- ─────────────────────────────────────────────
create or replace function public.refresh_product_rating(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  avg_rating numeric(3,2);
  cnt int;
begin
  select coalesce(round(avg(rating)::numeric, 2), 0), count(*)
    into avg_rating, cnt
  from public.reviews
  where product_id = p_product_id;

  update public.products
  set rating = avg_rating,
      review_count = cnt,
      updated_at = now()
  where id = p_product_id;
end;
$$;

create or replace function public.refresh_vendor_rating(p_vendor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  avg_rating numeric(3,2);
  cnt int;
begin
  select coalesce(round(avg(vendor_rating)::numeric, 2), 0), count(*)
    into avg_rating, cnt
  from public.reviews
  where vendor_id = p_vendor_id;

  update public.vendors
  set rating = avg_rating,
      review_count = cnt,
      updated_at = now()
  where id = p_vendor_id;
end;
$$;

create or replace function public.reviews_refresh_ratings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_product_rating(old.product_id);
    perform public.refresh_vendor_rating(old.vendor_id);
    return old;
  end if;

  perform public.refresh_product_rating(new.product_id);
  perform public.refresh_vendor_rating(new.vendor_id);

  if tg_op = 'UPDATE' then
    if old.product_id is distinct from new.product_id then
      perform public.refresh_product_rating(old.product_id);
    end if;
    if old.vendor_id is distinct from new.vendor_id then
      perform public.refresh_vendor_rating(old.vendor_id);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_refresh_ratings on public.reviews;
create trigger reviews_refresh_ratings
  after insert or update or delete on public.reviews
  for each row execute function public.reviews_refresh_ratings();

-- ─────────────────────────────────────────────
-- SUBMIT REVIEW (RPC sécurisé)
-- ─────────────────────────────────────────────
create or replace function public.submit_review(
  p_order_id uuid,
  p_product_id uuid,
  p_rating int,
  p_vendor_rating int,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order record;
  v_item_exists boolean;
  v_review_id uuid;
  v_vendor_user uuid;
  v_product_name text;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'La note produit doit être entre 1 et 5';
  end if;

  if p_vendor_rating is null or p_vendor_rating < 1 or p_vendor_rating > 5 then
    raise exception 'La note vendeur doit être entre 1 et 5';
  end if;

  select id, user_id, vendor_id, status
    into v_order
  from public.orders
  where id = p_order_id;

  if v_order.id is null then
    raise exception 'Commande introuvable';
  end if;

  if v_order.user_id is distinct from v_uid then
    raise exception 'Cette commande ne vous appartient pas';
  end if;

  if v_order.status is distinct from 'delivered' then
    raise exception 'Vous ne pouvez noter qu''après livraison';
  end if;

  if v_order.vendor_id is null then
    raise exception 'Commande sans vendeur';
  end if;

  select exists (
    select 1 from public.order_items
    where order_id = p_order_id and product_id = p_product_id
  ) into v_item_exists;

  if not v_item_exists then
    raise exception 'Ce produit ne fait pas partie de la commande';
  end if;

  if not exists (
    select 1 from public.products
    where id = p_product_id and vendor_id = v_order.vendor_id
  ) then
    raise exception 'Produit / vendeur incohérents';
  end if;

  insert into public.reviews (
    user_id, product_id, vendor_id, order_id, rating, vendor_rating, comment
  )
  values (
    v_uid,
    p_product_id,
    v_order.vendor_id,
    p_order_id,
    p_rating,
    p_vendor_rating,
    nullif(trim(coalesce(p_comment, '')), '')
  )
  on conflict (user_id, product_id, order_id) do update
    set rating = excluded.rating,
        vendor_rating = excluded.vendor_rating,
        comment = excluded.comment,
        updated_at = now()
  returning id into v_review_id;

  select name into v_product_name from public.products where id = p_product_id;
  select user_id into v_vendor_user from public.vendors where id = v_order.vendor_id;

  if v_vendor_user is not null then
    perform public.notify_user(
      v_vendor_user,
      'Nouvel avis client',
      coalesce(v_product_name, 'Un produit') || ' a reçu une note de ' || p_rating || '/5.',
      'review',
      '/vendeur/produits',
      jsonb_build_object(
        'review_id', v_review_id,
        'product_id', p_product_id,
        'rating', p_rating,
        'vendor_rating', p_vendor_rating
      )
    );
  end if;

  return v_review_id;
end;
$$;

revoke all on function public.submit_review(uuid, uuid, int, int, text) from public;
grant execute on function public.submit_review(uuid, uuid, int, int, text) to authenticated;

revoke all on function public.refresh_product_rating(uuid) from public;
revoke all on function public.refresh_vendor_rating(uuid) from public;
