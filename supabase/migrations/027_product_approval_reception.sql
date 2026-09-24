-- AfriZone 027 — Validation admin des produits + réception entrepôt (photo réelle)
-- Un produit n'apparaît sur l'accueil / le catalogue qu'après approbation admin.

-- ─── 1) Colonnes approbation + réception ────────────────────────────
alter table public.products
  add column if not exists approval_status text not null default 'pending',
  add column if not exists approval_requested_at timestamptz not null default now(),
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists rejection_reason text,
  -- Étape 2 du formulaire vendeur : comment AfriZone réceptionne le produit
  add column if not exists real_images text[] not null default '{}'::text[],
  add column if not exists handover_method text,
  add column if not exists warehouse_city text,
  add column if not exists expected_dropoff_at date,
  add column if not exists package_count integer,
  add column if not exists package_weight_kg numeric(8,2),
  add column if not exists package_length_cm numeric(8,1),
  add column if not exists package_width_cm numeric(8,1),
  add column if not exists package_height_cm numeric(8,1),
  add column if not exists reception_contact_name text,
  add column if not exists reception_contact_phone text,
  add column if not exists reception_notes text;

alter table public.products drop constraint if exists products_approval_status_check;
alter table public.products
  add constraint products_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected'));

-- drop_off      : le vendeur dépose lui-même au hub AfriZone
-- pickup_request: AfriZone vient enlever chez le vendeur
-- vendor_stock  : le vendeur garde le stock et livre lui-même
alter table public.products drop constraint if exists products_handover_method_check;
alter table public.products
  add constraint products_handover_method_check
  check (
    handover_method is null
    or handover_method in ('drop_off', 'pickup_request', 'vendor_stock')
  );

create index if not exists products_approval_status_idx
  on public.products(approval_status);
create index if not exists products_approval_pending_idx
  on public.products(approval_requested_at desc)
  where approval_status = 'pending';

comment on column public.products.real_images is
  'Photos réelles du produit prises par le vendeur (étape réception entrepôt)';
comment on column public.products.images is
  'Photos génériques / catalogue du produit (étape 1)';

-- ─── 2) Backfill : le catalogue existant reste visible ──────────────
do $$
begin
  if not exists (
    select 1 from public.app_settings where key = 'products_approval_backfilled'
  ) then
    update public.products
    set
      approval_status = 'approved',
      approved_at = coalesce(approved_at, created_at);

    insert into public.app_settings (key, value)
    values ('products_approval_backfilled', 'true')
    on conflict (key) do nothing;
  end if;
end $$;

-- ─── 3) Le vendeur ne peut pas s'auto-approuver ─────────────────────
create or replace function public.products_guard_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Seed SQL / service_role / admin : aucune contrainte
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.approval_status := 'pending';
    new.approval_requested_at := now();
    new.approved_at := null;
    new.approved_by := null;
    new.rejection_reason := null;
    return new;
  end if;

  -- Un vendeur ne touche jamais aux champs de modération
  new.approval_status := old.approval_status;
  new.approval_requested_at := old.approval_requested_at;
  new.approved_at := old.approved_at;
  new.approved_by := old.approved_by;
  new.rejection_reason := old.rejection_reason;

  -- Modifier le contenu commercial repasse le produit en validation
  if new.name is distinct from old.name
    or new.description is distinct from old.description
    or new.price is distinct from old.price
    or new.category is distinct from old.category
    or new.subcategory is distinct from old.subcategory
    or new.condition is distinct from old.condition
    or new.images is distinct from old.images
    or new.real_images is distinct from old.real_images
    or new.main_image is distinct from old.main_image
    or new.handover_method is distinct from old.handover_method
  then
    new.approval_status := 'pending';
    new.approval_requested_at := now();
    new.approved_at := null;
    new.approved_by := null;
    new.rejection_reason := null;
  end if;

  return new;
end;
$$;

drop trigger if exists products_guard_approval on public.products;
create trigger products_guard_approval
  before insert or update on public.products
  for each row execute function public.products_guard_approval();

-- ─── 4) Lecture publique : produits actifs ET approuvés ─────────────
-- Les policies étant cumulatives (OR), on retire toutes les variantes
-- historiques de lecture, sinon l'ancienne (is_active = true) continuerait
-- d'exposer les produits non validés.
drop policy if exists "Active products are public" on public.products;
drop policy if exists "Products readable by public owner or admin" on public.products;
create policy "Products readable by public owner or admin"
  on public.products for select
  using (
    (is_active = true and approval_status = 'approved')
    or exists (
      select 1 from public.vendors v
      where v.id = products.vendor_id and v.user_id = auth.uid()
    )
    or public.is_admin()
  );

-- ─── 5) Notification vendeur à la soumission ────────────────────────
create or replace function public.notify_product_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if new.approval_status <> 'pending' then
    return new;
  end if;

  select user_id into v_user_id from public.vendors where id = new.vendor_id;
  if v_user_id is null then
    return new;
  end if;

  perform public.notify_user(
    v_user_id,
    'Produit en attente de validation',
    '« ' || new.name || ' » a été envoyé à l''équipe AfriZone. Il sera visible sur '
      || 'l''accueil et le catalogue après approbation.',
    'product',
    '/vendeur/produits',
    jsonb_build_object('product_id', new.id, 'approval_status', new.approval_status)
  );

  return new;
end;
$$;

drop trigger if exists notify_product_submitted on public.products;
create trigger notify_product_submitted
  after insert on public.products
  for each row execute function public.notify_product_submitted();

-- ─── 6) Admin : approuver / refuser ─────────────────────────────────
create or replace function public.admin_review_product(
  p_product_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_user_id uuid;
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'Admin requis';
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Produit introuvable';
  end if;

  if not p_approve and coalesce(trim(p_reason), '') = '' then
    raise exception 'Motif de refus obligatoire';
  end if;

  v_status := case when p_approve then 'approved' else 'rejected' end;

  update public.products
  set
    approval_status = v_status,
    approved_at = case when p_approve then now() else null end,
    approved_by = case when p_approve then auth.uid() else null end,
    rejection_reason = case when p_approve then null else trim(p_reason) end,
    updated_at = now()
  where id = p_product_id;

  select user_id into v_user_id from public.vendors where id = v_product.vendor_id;

  if v_user_id is not null then
    perform public.notify_user(
      v_user_id,
      case when p_approve then 'Produit approuvé' else 'Produit refusé' end,
      case
        when p_approve then '« ' || v_product.name
          || ' » est en ligne sur l''accueil et le catalogue AfriZone.'
        else '« ' || v_product.name || ' » a été refusé : ' || trim(p_reason)
      end,
      'product',
      '/vendeur/produits',
      jsonb_build_object('product_id', p_product_id, 'approval_status', v_status)
    );
  end if;

  return jsonb_build_object('ok', true, 'product_id', p_product_id, 'approval_status', v_status);
end;
$$;

grant execute on function public.admin_review_product(uuid, boolean, text) to authenticated;
