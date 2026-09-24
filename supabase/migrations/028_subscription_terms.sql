-- AfriZone 028 — Durées d'abonnement 1 / 6 / 12 / 24 / 48 mois + remises engagement
-- La remise démarre à partir de 12 mois (1 an), comme prévu au CDC.

-- ─── 1) Barème des durées ───────────────────────────────────────────
create table if not exists public.subscription_terms (
  id uuid primary key default gen_random_uuid(),
  months integer not null unique check (months > 0),
  label text not null,
  discount_pct numeric(5,4) not null default 0
    check (discount_pct >= 0 and discount_pct < 1),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.subscription_terms (months, label, discount_pct, sort_order)
values
  (1,  '1 mois',   0.00, 1),
  (6,  '6 mois',   0.00, 2),
  (12, '12 mois',  0.10, 3),
  (24, '24 mois',  0.15, 4),
  (48, '48 mois',  0.25, 5)
on conflict (months) do update set
  label = excluded.label,
  discount_pct = excluded.discount_pct,
  sort_order = excluded.sort_order,
  is_active = true;

alter table public.subscription_terms enable row level security;

drop policy if exists "Terms readable by all" on public.subscription_terms;
create policy "Terms readable by all"
  on public.subscription_terms for select
  using (is_active = true or public.is_admin());

drop policy if exists "Admin manage terms" on public.subscription_terms;
create policy "Admin manage terms"
  on public.subscription_terms for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ─── 2) Abonnement : durée souscrite + montant réellement payé ──────
alter table public.subscriptions
  add column if not exists term_months integer not null default 1,
  add column if not exists discount_pct numeric(5,4) not null default 0,
  add column if not exists amount_paid_xof integer;

alter table public.subscriptions drop constraint if exists subscriptions_term_months_check;
alter table public.subscriptions
  add constraint subscriptions_term_months_check check (term_months > 0);

-- ─── 3) Devis : base, remise, total, équivalent mensuel ─────────────
create or replace function public.subscription_quote(
  p_plan_id uuid,
  p_months integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_price integer;
  v_months integer := greatest(1, coalesce(p_months, 1));
  v_discount numeric(5,4) := 0;
  v_base integer;
  v_saved integer;
  v_total integer;
begin
  select price_xof into v_price
  from public.subscription_plans
  where id = p_plan_id and is_active = true;

  if v_price is null then
    raise exception 'Plan introuvable ou inactif';
  end if;

  select discount_pct into v_discount
  from public.subscription_terms
  where months = v_months and is_active = true;

  if v_discount is null then
    raise exception 'Durée non proposée : % mois', v_months;
  end if;

  v_base := v_price * v_months;
  v_saved := round(v_base * v_discount);
  v_total := v_base - v_saved;

  return jsonb_build_object(
    'plan_id', p_plan_id,
    'months', v_months,
    'monthly_price_xof', v_price,
    'base_xof', v_base,
    'discount_pct', v_discount,
    'discount_xof', v_saved,
    'total_xof', v_total,
    'effective_monthly_xof', case when v_months > 0 then round(v_total::numeric / v_months) else v_total end
  );
end;
$$;

grant execute on function public.subscription_quote(uuid, integer) to authenticated, anon;

-- ─── 4) Créer son abonnement en attente (montant calculé serveur) ───
create or replace function public.create_my_subscription(
  p_plan_id uuid,
  p_months integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_quote jsonb;
  v_sub_id uuid;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;

  v_quote := public.subscription_quote(p_plan_id, p_months);

  if (v_quote->>'total_xof')::integer <= 0 then
    raise exception 'Ce plan est gratuit';
  end if;

  insert into public.subscriptions (
    user_id, plan_id, status, term_months, discount_pct, amount_paid_xof
  ) values (
    v_uid,
    p_plan_id,
    'pending',
    (v_quote->>'months')::integer,
    (v_quote->>'discount_pct')::numeric,
    (v_quote->>'total_xof')::integer
  )
  returning id into v_sub_id;

  return v_quote || jsonb_build_object('subscription_id', v_sub_id);
end;
$$;

grant execute on function public.create_my_subscription(uuid, integer) to authenticated;

-- ─── 5) Activation : la validité suit la durée souscrite ────────────
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

  -- duration_days = durée d'un « mois » de plan, multipliée par la durée souscrite
  v_days := coalesce(v_sub.duration_days, 30) * greatest(1, coalesce(v_sub.term_months, 1));

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
    amount_paid_xof = coalesce(
      amount_paid_xof,
      v_sub.price_xof * greatest(1, coalesce(v_sub.term_months, 1))
    ),
    updated_at = now()
  where id = p_subscription_id;

  perform public.apply_subscription_entitlements(p_subscription_id);

  return jsonb_build_object(
    'ok', true,
    'subscription_id', p_subscription_id,
    'term_months', greatest(1, coalesce(v_sub.term_months, 1)),
    'days', v_days
  );
end;
$$;

grant execute on function public.activate_subscription(uuid) to service_role;

-- ─── 6) Crédits livraison Club : proportionnels à la durée ──────────
-- Le quota mensuel est reconduit chaque mois glissant de l'abonnement.
create or replace function public.club_shipping_credits_quota(p_subscription_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_sub record;
  v_per_month integer;
  v_elapsed integer;
begin
  select s.starts_at, s.term_months, p.features
  into v_sub
  from public.subscriptions s
  join public.subscription_plans p on p.id = s.plan_id
  where s.id = p_subscription_id;

  if not found then
    return 0;
  end if;

  v_per_month := coalesce((v_sub.features->>'shippingCreditsPerMonth')::int, 0);
  if v_per_month <= 0 then
    return 0;
  end if;

  v_elapsed := greatest(
    1,
    least(
      coalesce(v_sub.term_months, 1),
      1 + floor(extract(epoch from (now() - coalesce(v_sub.starts_at, now()))) / (30 * 86400))::int
    )
  );

  return v_per_month * v_elapsed;
end;
$$;

grant execute on function public.club_shipping_credits_quota(uuid) to authenticated, anon;

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
  v_max := public.club_shipping_credits_quota(v_sub.id);

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
  select s.id, s.shipping_credits_used, p.features
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
  v_max := public.club_shipping_credits_quota(v_sub.id);

  if v_sub.shipping_credits_used >= v_max then
    return 0;
  end if;

  return v_discount;
end;
$$;

grant execute on function public.preview_club_shipping_discount(uuid) to authenticated, anon;

-- ─── 7) get_active_subscription : exposer durée + quota ─────────────
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
    s.term_months,
    s.discount_pct,
    s.amount_paid_xof,
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
    'shipping_credits_quota', public.club_shipping_credits_quota(v_row.id),
    'term_months', coalesce(v_row.term_months, 1),
    'discount_pct', coalesce(v_row.discount_pct, 0),
    'amount_paid_xof', v_row.amount_paid_xof,
    'plan_code', v_row.plan_code,
    'plan_name', v_row.plan_name,
    'audience', v_row.audience,
    'price_xof', v_row.price_xof,
    'features', v_row.features
  );
end;
$$;

grant execute on function public.get_active_subscription(uuid) to authenticated, anon;
