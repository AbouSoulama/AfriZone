-- AfriZone 025 — Abonnements client/vendeur + emplacements pubs

-- ─── payment_intents : kind subscription + lien abo ─────────────────
alter table public.payment_intents
  drop constraint if exists payment_intents_kind_check;

alter table public.payment_intents
  add constraint payment_intents_kind_check
  check (kind in ('order', 'parcel', 'subscription'));

alter table public.payment_intents
  add column if not exists subscription_id uuid;

-- ─── Plans ──────────────────────────────────────────────────────────
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  audience text not null check (audience in ('client', 'vendor')),
  name text not null,
  price_xof integer not null check (price_xof >= 0),
  duration_days integer not null default 30 check (duration_days > 0),
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ─── Abonnements ────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'expired', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  payment_intent_id uuid references public.payment_intents(id) on delete set null,
  shipping_credits_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_idx on public.subscriptions(user_id);
create index if not exists subscriptions_status_idx on public.subscriptions(status);
create index if not exists subscriptions_ends_idx on public.subscriptions(ends_at);

alter table public.payment_intents
  drop constraint if exists payment_intents_subscription_id_fkey;
alter table public.payment_intents
  add constraint payment_intents_subscription_id_fkey
  foreign key (subscription_id) references public.subscriptions(id) on delete set null;

-- ─── Pubs / placements ──────────────────────────────────────────────
create table if not exists public.ad_placements (
  id uuid primary key default gen_random_uuid(),
  subscriber_user_id uuid not null references public.profiles(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  slot text not null check (slot in ('hero', 'home_banner', 'featured_vendor')),
  title text not null,
  subtitle text,
  image_url text,
  link_url text,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'ended')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_placements_slot_status_idx
  on public.ad_placements(slot, status);
create index if not exists ad_placements_user_idx
  on public.ad_placements(subscriber_user_id);

-- ─── Vendeur : commission override + boost abo ──────────────────────
alter table public.vendors
  add column if not exists subscription_commission_pct numeric(5,4),
  add column if not exists subscription_boost boolean not null default false,
  add column if not exists subscription_plan_code text;

-- ─── Seed plans ─────────────────────────────────────────────────────
insert into public.subscription_plans (code, audience, name, price_xof, duration_days, features, sort_order)
values
  (
    'client_free', 'client', 'Gratuit', 0, 30,
    '{"shippingDiscount":0,"shippingCreditsPerMonth":0,"badge":false}'::jsonb,
    0
  ),
  (
    'client_club', 'client', 'AfriZone Club', 2000, 30,
    '{"shippingDiscount":1000,"shippingCreditsPerMonth":4,"badge":true,"priorityPromos":true}'::jsonb,
    1
  ),
  (
    'vendor_free', 'vendor', 'Gratuit', 0, 30,
    '{"featuredProducts":0,"badge":null,"adSlots":0,"commissionPct":0.10,"vendorBoost":false}'::jsonb,
    0
  ),
  (
    'vendor_pro', 'vendor', 'Pro', 7500, 30,
    '{"featuredProducts":3,"badge":"pro","adSlots":0,"commissionPct":0.10,"vendorBoost":true}'::jsonb,
    1
  ),
  (
    'vendor_business', 'vendor', 'Business', 25000, 30,
    '{"featuredProducts":8,"badge":"business","adSlots":1,"commissionPct":0.07,"vendorBoost":true}'::jsonb,
    2
  )
on conflict (code) do update set
  name = excluded.name,
  price_xof = excluded.price_xof,
  features = excluded.features,
  is_active = true,
  sort_order = excluded.sort_order;

-- ─── RLS ────────────────────────────────────────────────────────────
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.ad_placements enable row level security;

drop policy if exists "Plans readable by all" on public.subscription_plans;
create policy "Plans readable by all"
  on public.subscription_plans for select
  using (is_active = true or public.is_admin());

drop policy if exists "Admin manage plans" on public.subscription_plans;
create policy "Admin manage plans"
  on public.subscription_plans for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Users read own subscriptions" on public.subscriptions;
create policy "Users read own subscriptions"
  on public.subscriptions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users insert own subscriptions" on public.subscriptions;
create policy "Users insert own subscriptions"
  on public.subscriptions for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users update own pending subscriptions" on public.subscriptions;
create policy "Users update own pending subscriptions"
  on public.subscriptions for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Active ads public read" on public.ad_placements;
create policy "Active ads public read"
  on public.ad_placements for select
  using (
    status = 'active'
    or subscriber_user_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "Users manage own ads" on public.ad_placements;
create policy "Users manage own ads"
  on public.ad_placements for all to authenticated
  using (subscriber_user_id = auth.uid() or public.is_admin())
  with check (subscriber_user_id = auth.uid() or public.is_admin());

-- ─── Helpers ────────────────────────────────────────────────────────
create or replace function public.get_active_subscription(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_row record;
begin
  select
    s.id,
    s.status,
    s.starts_at,
    s.ends_at,
    s.shipping_credits_used,
    p.code as plan_code,
    p.name as plan_name,
    p.audience,
    p.price_xof,
    p.features
  into v_row
  from public.subscriptions s
  join public.subscription_plans p on p.id = s.plan_id
  where s.user_id = coalesce(p_user_id, auth.uid())
    and s.status = 'active'
    and (s.ends_at is null or s.ends_at > now())
    and p.price_xof > 0
  order by s.ends_at desc nulls last
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'starts_at', v_row.starts_at,
    'ends_at', v_row.ends_at,
    'shipping_credits_used', v_row.shipping_credits_used,
    'plan_code', v_row.plan_code,
    'plan_name', v_row.plan_name,
    'audience', v_row.audience,
    'price_xof', v_row.price_xof,
    'features', v_row.features
  );
end;
$$;

grant execute on function public.get_active_subscription(uuid) to authenticated, anon;

create or replace function public.apply_subscription_entitlements(p_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_vendor_id uuid;
  v_feat jsonb;
  v_limit int;
  v_commission numeric;
begin
  select s.*, p.code as plan_code, p.audience, p.features, p.price_xof
  into v_sub
  from public.subscriptions s
  join public.subscription_plans p on p.id = s.plan_id
  where s.id = p_subscription_id;

  if not found or v_sub.status <> 'active' then
    return;
  end if;

  v_feat := coalesce(v_sub.features, '{}'::jsonb);

  if v_sub.audience = 'vendor' then
    select id into v_vendor_id
    from public.vendors
    where user_id = v_sub.user_id
    limit 1;

    if v_vendor_id is not null then
      v_commission := nullif((v_feat->>'commissionPct')::numeric, null);
      update public.vendors
      set
        subscription_commission_pct = v_commission,
        subscription_boost = coalesce((v_feat->>'vendorBoost')::boolean, false),
        subscription_plan_code = v_sub.plan_code,
        updated_at = now()
      where id = v_vendor_id;

      v_limit := coalesce((v_feat->>'featuredProducts')::int, 0);
      if v_limit > 0 then
        -- Featured les N produits les plus vendus du vendeur
        update public.products
        set is_featured = false
        where vendor_id = v_vendor_id;

        update public.products p
        set is_featured = true
        from (
          select id
          from public.products
          where vendor_id = v_vendor_id and is_active = true
          order by sold_count desc nulls last, created_at desc
          limit v_limit
        ) top
        where p.id = top.id;
      end if;
    end if;
  end if;
end;
$$;

create or replace function public.activate_subscription(p_subscription_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_days int;
begin
  select s.*, p.duration_days, p.price_xof
  into v_sub
  from public.subscriptions s
  join public.subscription_plans p on p.id = s.plan_id
  where s.id = p_subscription_id
  for update of s;

  if not found then
    raise exception 'Abonnement introuvable';
  end if;

  v_days := coalesce(v_sub.duration_days, 30);

  -- Expire les autres abos payants actifs du même audience
  update public.subscriptions s
  set status = 'expired', updated_at = now()
  from public.subscription_plans p
  where s.user_id = v_sub.user_id
    and s.id <> p_subscription_id
    and s.status = 'active'
    and p.id = s.plan_id
    and p.audience = (
      select audience from public.subscription_plans where id = v_sub.plan_id
    );

  update public.subscriptions
  set
    status = 'active',
    starts_at = coalesce(starts_at, now()),
    ends_at = now() + (v_days || ' days')::interval,
    shipping_credits_used = 0,
    updated_at = now()
  where id = p_subscription_id;

  perform public.apply_subscription_entitlements(p_subscription_id);

  return jsonb_build_object('ok', true, 'subscription_id', p_subscription_id);
end;
$$;

grant execute on function public.activate_subscription(uuid) to service_role;

-- Remise Club livraison (consomme 1 crédit)
create or replace function public.consume_club_shipping_credit(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_discount int;
  v_max int;
begin
  select s.id, s.shipping_credits_used, p.features
  into v_sub
  from public.subscriptions s
  join public.subscription_plans p on p.id = s.plan_id
  where s.user_id = p_user_id
    and s.status = 'active'
    and (s.ends_at is null or s.ends_at > now())
    and p.code = 'client_club'
  order by s.ends_at desc
  limit 1
  for update of s;

  if not found then
    return 0;
  end if;

  v_discount := coalesce((v_sub.features->>'shippingDiscount')::int, 0);
  v_max := coalesce((v_sub.features->>'shippingCreditsPerMonth')::int, 0);

  if v_discount <= 0 or v_sub.shipping_credits_used >= v_max then
    return 0;
  end if;

  update public.subscriptions
  set shipping_credits_used = shipping_credits_used + 1, updated_at = now()
  where id = v_sub.id;

  return v_discount;
end;
$$;

grant execute on function public.consume_club_shipping_credit(uuid) to authenticated, service_role;

-- Preview remise sans consommer
create or replace function public.preview_club_shipping_discount(p_user_id uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_sub record;
  v_discount int;
  v_max int;
begin
  select s.shipping_credits_used, p.features
  into v_sub
  from public.subscriptions s
  join public.subscription_plans p on p.id = s.plan_id
  where s.user_id = coalesce(p_user_id, auth.uid())
    and s.status = 'active'
    and (s.ends_at is null or s.ends_at > now())
    and p.code = 'client_club'
  order by s.ends_at desc
  limit 1;

  if not found then
    return 0;
  end if;

  v_discount := coalesce((v_sub.features->>'shippingDiscount')::int, 0);
  v_max := coalesce((v_sub.features->>'shippingCreditsPerMonth')::int, 0);
  if v_sub.shipping_credits_used >= v_max then
    return 0;
  end if;
  return v_discount;
end;
$$;

grant execute on function public.preview_club_shipping_discount(uuid) to authenticated, anon;

-- ─── complete payment : activer abo ─────────────────────────────────
create or replace function public.complete_cinetpay_payment(
  p_transaction_id text,
  p_operator text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.payment_intents%rowtype;
  v_orders int := 0;
  v_parcels int := 0;
  v_sub_ok boolean := false;
begin
  if p_transaction_id is null or length(trim(p_transaction_id)) = 0 then
    raise exception 'transaction_id manquant';
  end if;

  select * into v_intent
  from public.payment_intents
  where transaction_id = p_transaction_id
  for update;

  if not found then
    raise exception 'Session de paiement introuvable';
  end if;

  if v_intent.status = 'paid' then
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'kind', v_intent.kind,
      'order_ids', to_jsonb(v_intent.order_ids),
      'parcel_id', v_intent.parcel_id,
      'subscription_id', v_intent.subscription_id
    );
  end if;

  update public.payment_intents
  set
    status = 'paid',
    operator_name = coalesce(p_operator, operator_name),
    updated_at = now()
  where id = v_intent.id;

  if v_intent.kind = 'order' and coalesce(array_length(v_intent.order_ids, 1), 0) > 0 then
    update public.orders
    set
      status = 'confirmed',
      payment_status = 'paid',
      updated_at = now()
    where id = any (v_intent.order_ids)
      and payment_status is distinct from 'paid';
    get diagnostics v_orders = row_count;
  end if;

  if v_intent.kind = 'parcel' and v_intent.parcel_id is not null then
    update public.parcel_shipments
    set
      payment_status = 'paid',
      updated_at = now()
    where id = v_intent.parcel_id
      and payment_status is distinct from 'paid';
    get diagnostics v_parcels = row_count;
  end if;

  if v_intent.kind = 'subscription' and v_intent.subscription_id is not null then
    perform public.activate_subscription(v_intent.subscription_id);
    v_sub_ok := true;
  end if;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'kind', v_intent.kind,
    'order_ids', to_jsonb(v_intent.order_ids),
    'parcel_id', v_intent.parcel_id,
    'subscription_id', v_intent.subscription_id,
    'orders_updated', v_orders,
    'parcels_updated', v_parcels,
    'subscription_activated', v_sub_ok
  );
end;
$$;

revoke all on function public.complete_cinetpay_payment(text, text) from public;
grant execute on function public.complete_cinetpay_payment(text, text) to service_role;

-- Expire auto (optionnel, appelé côté lecture)
create or replace function public.expire_due_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.subscriptions
  set status = 'expired', updated_at = now()
  where status = 'active'
    and ends_at is not null
    and ends_at < now();
  get diagnostics n = row_count;

  update public.vendors v
  set
    subscription_commission_pct = null,
    subscription_boost = false,
    subscription_plan_code = null,
    updated_at = now()
  where v.subscription_plan_code is not null
    and not exists (
      select 1 from public.subscriptions s
      join public.subscription_plans p on p.id = s.plan_id
      where s.user_id = v.user_id
        and s.status = 'active'
        and (s.ends_at is null or s.ends_at > now())
        and p.audience = 'vendor'
        and p.price_xof > 0
    );

  update public.ad_placements
  set status = 'ended', updated_at = now()
  where status = 'active'
    and ends_at is not null
    and ends_at < now();

  return n;
end;
$$;

grant execute on function public.expire_due_subscriptions() to authenticated, service_role;
create or replace function public.activate_my_pending_subscription(p_subscription_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_status text;
begin
  if v_uid is null then
    raise exception 'Non authentifiÃ©';
  end if;
  select user_id, status into v_owner, v_status
  from public.subscriptions where id = p_subscription_id;
  if not found then raise exception 'Abonnement introuvable'; end if;
  if v_owner <> v_uid and not public.is_admin() then
    raise exception 'AccÃ¨s refusÃ©';
  end if;
  if v_status not in ('pending', 'active') then
    raise exception 'Statut invalide';
  end if;
  return public.activate_subscription(p_subscription_id);
end;
$$;

grant execute on function public.activate_my_pending_subscription(uuid) to authenticated;

