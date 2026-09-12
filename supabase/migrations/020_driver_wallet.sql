-- AfriZone — Portefeuille livreur + gains + retraits hebdomadaires
-- Crédit automatique à deliveries.status = delivered

-- ─────────────────────────────────────────────
-- COMPTES DE RETRAIT
-- ─────────────────────────────────────────────
create table if not exists public.driver_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null unique references public.drivers(id) on delete cascade,
  provider text not null check (provider in ('orange_money', 'moov_money', 'mtn_money', 'wave')),
  phone text not null,
  account_name text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists driver_payout_accounts_driver_idx
  on public.driver_payout_accounts(driver_id);

-- ─────────────────────────────────────────────
-- RÈGLES DE TARIFICATION
-- ─────────────────────────────────────────────
create table if not exists public.driver_rate_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  base_amount integer not null default 1000 check (base_amount >= 0),
  same_city_bonus integer not null default 0,
  intercity_bonus integer not null default 500,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.driver_rate_rules (code, label, base_amount, same_city_bonus, intercity_bonus)
values ('default', 'Tarif standard AfriZone', 1000, 0, 500)
on conflict (code) do nothing;

insert into public.app_settings (key, value) values
  ('driver_withdraw_min', '2000'),
  ('driver_withdraw_window', 'fri-sun'),
  ('driver_timezone', 'Africa/Ouagadougou')
on conflict (key) do nothing;

-- ─────────────────────────────────────────────
-- GAINS PAR COURSE
-- ─────────────────────────────────────────────
create table if not exists public.driver_earnings (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  delivery_id uuid not null unique references public.deliveries(id) on delete cascade,
  gross_amount integer not null check (gross_amount >= 0),
  bonus_amount integer not null default 0,
  penalty_amount integer not null default 0,
  net_amount integer not null check (net_amount >= 0),
  currency text not null default 'XOF',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists driver_earnings_driver_idx on public.driver_earnings(driver_id);
create index if not exists driver_earnings_created_idx on public.driver_earnings(created_at desc);

-- ─────────────────────────────────────────────
-- LEDGER PORTEFEUILLE
-- ─────────────────────────────────────────────
create table if not exists public.driver_wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  entry_type text not null check (entry_type in ('credit', 'debit', 'hold', 'payout', 'reversal')),
  amount integer not null check (amount > 0),
  balance_after integer not null,
  reference_type text,
  reference_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists driver_wallet_ledger_driver_idx
  on public.driver_wallet_ledger(driver_id, created_at desc);

-- ─────────────────────────────────────────────
-- DEMANDES DE RETRAIT
-- ─────────────────────────────────────────────
create table if not exists public.driver_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  amount integer not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'paid', 'rejected', 'failed')),
  provider text,
  phone text,
  week_key text not null,
  admin_note text,
  payment_reference text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists driver_withdrawal_driver_idx
  on public.driver_withdrawal_requests(driver_id, created_at desc);
create index if not exists driver_withdrawal_status_idx
  on public.driver_withdrawal_requests(status);

drop trigger if exists driver_payout_accounts_updated_at on public.driver_payout_accounts;
create trigger driver_payout_accounts_updated_at
  before update on public.driver_payout_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists driver_withdrawal_requests_updated_at on public.driver_withdrawal_requests;
create trigger driver_withdrawal_requests_updated_at
  before update on public.driver_withdrawal_requests
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- HELPERS
-- ─────────────────────────────────────────────
create or replace function public.driver_wallet_balance(p_driver_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select balance_after
     from public.driver_wallet_ledger
     where driver_id = p_driver_id
     order by created_at desc, id desc
     limit 1),
    0
  );
$$;

create or replace function public.driver_week_key(p_ts timestamptz default now())
returns text
language plpgsql
stable
as $$
declare
  v_local timestamp;
  v_dow int;
  v_monday date;
begin
  v_local := p_ts at time zone 'Africa/Ouagadougou';
  v_dow := extract(isodow from v_local)::int; -- 1=lundi … 7=dimanche
  v_monday := (v_local::date - (v_dow - 1));
  return to_char(v_monday, 'IYYY-"W"IW');
end;
$$;

-- Fenêtre de retrait : vendredi 00:00 → dimanche 23:59:59 (Afrique/Ouagadougou)
create or replace function public.is_driver_withdraw_window(p_ts timestamptz default now())
returns boolean
language plpgsql
stable
as $$
declare
  v_dow int;
begin
  v_dow := extract(isodow from (p_ts at time zone 'Africa/Ouagadougou'))::int;
  return v_dow in (5, 6, 7);
end;
$$;

create or replace function public.compute_delivery_earning(
  p_pickup_city text,
  p_delivery_city text
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rule public.driver_rate_rules%rowtype;
  v_amount integer;
begin
  select * into v_rule
  from public.driver_rate_rules
  where active = true
  order by case when code = 'default' then 0 else 1 end
  limit 1;

  if not found then
    return 1000;
  end if;

  v_amount := v_rule.base_amount;
  if lower(trim(coalesce(p_pickup_city, ''))) = lower(trim(coalesce(p_delivery_city, ''))) then
    v_amount := v_amount + v_rule.same_city_bonus;
  else
    v_amount := v_amount + v_rule.intercity_bonus;
  end if;

  return greatest(v_amount, 0);
end;
$$;

-- Crédit portefeuille après livraison
create or replace function public.credit_driver_for_delivery(p_delivery_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_del public.deliveries%rowtype;
  v_net integer;
  v_balance integer;
  v_earning_id uuid;
  v_ledger_id uuid;
begin
  select * into v_del from public.deliveries where id = p_delivery_id for update;
  if not found then
    raise exception 'Course introuvable';
  end if;
  if v_del.status is distinct from 'delivered' then
    raise exception 'La course n''est pas livrée';
  end if;
  if v_del.driver_id is null then
    raise exception 'Aucun livreur assigné';
  end if;

  if exists (select 1 from public.driver_earnings where delivery_id = p_delivery_id) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  v_net := public.compute_delivery_earning(v_del.pickup_city, v_del.delivery_city);
  v_balance := public.driver_wallet_balance(v_del.driver_id) + v_net;

  insert into public.driver_earnings (
    driver_id, delivery_id, gross_amount, bonus_amount, penalty_amount, net_amount, note
  ) values (
    v_del.driver_id, p_delivery_id, v_net, 0, 0, v_net,
    'Gain course ' || coalesce(v_del.pickup_city, '') || ' → ' || coalesce(v_del.delivery_city, '')
  )
  returning id into v_earning_id;

  insert into public.driver_wallet_ledger (
    driver_id, entry_type, amount, balance_after, reference_type, reference_id, note
  ) values (
    v_del.driver_id, 'credit', v_net, v_balance, 'earning', v_earning_id,
    'Crédit livraison'
  )
  returning id into v_ledger_id;

  -- Notifier le livreur
  perform public.notify_user(
    (select user_id from public.drivers where id = v_del.driver_id),
    'Gain crédité',
    v_net::text || ' FCFA ont été ajoutés à votre portefeuille AfriZone.',
    'payment',
    '/portefeuille',
    jsonb_build_object('earning_id', v_earning_id, 'amount', v_net, 'delivery_id', p_delivery_id)
  );

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'earning_id', v_earning_id,
    'ledger_id', v_ledger_id,
    'amount', v_net,
    'balance', v_balance
  );
end;
$$;

create or replace function public.on_delivery_delivered_credit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'delivered'
     and (old.status is distinct from 'delivered')
     and new.driver_id is not null then
    perform public.credit_driver_for_delivery(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists deliveries_credit_on_delivered on public.deliveries;
create trigger deliveries_credit_on_delivered
  after update of status on public.deliveries
  for each row execute function public.on_delivery_delivered_credit();

-- Demande de retrait (appelée par le livreur)
create or replace function public.request_driver_withdrawal(p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid;
  v_balance integer;
  v_min integer;
  v_account public.driver_payout_accounts%rowtype;
  v_req_id uuid;
  v_new_balance integer;
begin
  select id into v_driver_id
  from public.drivers
  where user_id = auth.uid() and status = 'approved';

  if v_driver_id is null then
    raise exception 'Profil livreur introuvable ou non approuvé';
  end if;

  if not public.is_driver_withdraw_window(now()) then
    raise exception 'Les retraits ne sont ouverts que du vendredi au dimanche';
  end if;

  v_min := coalesce(nullif(public.app_setting('driver_withdraw_min'), '')::integer, 2000);
  if p_amount is null or p_amount < v_min then
    raise exception 'Montant minimum de retrait : % FCFA', v_min;
  end if;

  select * into v_account
  from public.driver_payout_accounts
  where driver_id = v_driver_id;

  if not found then
    raise exception 'Configurez d''abord votre numéro Mobile Money / Wave';
  end if;

  v_balance := public.driver_wallet_balance(v_driver_id);
  if p_amount > v_balance then
    raise exception 'Solde insuffisant (% FCFA disponibles)', v_balance;
  end if;

  if exists (
    select 1 from public.driver_withdrawal_requests
    where driver_id = v_driver_id and status = 'pending'
  ) then
    raise exception 'Une demande de retrait est déjà en cours';
  end if;

  v_new_balance := v_balance - p_amount;

  insert into public.driver_withdrawal_requests (
    driver_id, amount, status, provider, phone, week_key
  ) values (
    v_driver_id, p_amount, 'pending', v_account.provider, v_account.phone,
    public.driver_week_key(now())
  )
  returning id into v_req_id;

  insert into public.driver_wallet_ledger (
    driver_id, entry_type, amount, balance_after, reference_type, reference_id, note
  ) values (
    v_driver_id, 'hold', p_amount, v_new_balance, 'withdrawal', v_req_id,
    'Retrait demandé — fonds réservés'
  );

  perform public.notify_admins(
    'Demande de retrait livreur',
    p_amount::text || ' FCFA — ' || coalesce(v_account.provider, '') || ' ' || coalesce(v_account.phone, ''),
    'payment',
    '/admin/retraits',
    jsonb_build_object('withdrawal_id', v_req_id, 'driver_id', v_driver_id, 'amount', p_amount)
  );

  return jsonb_build_object(
    'ok', true,
    'withdrawal_id', v_req_id,
    'amount', p_amount,
    'balance', v_new_balance
  );
end;
$$;

-- Admin : marquer un retrait payé / rejeté
create or replace function public.admin_review_withdrawal(
  p_withdrawal_id uuid,
  p_action text,
  p_payment_reference text default null,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.driver_withdrawal_requests%rowtype;
  v_balance integer;
begin
  if not public.is_admin() then
    raise exception 'Accès admin requis';
  end if;

  select * into v_req
  from public.driver_withdrawal_requests
  where id = p_withdrawal_id
  for update;

  if not found then
    raise exception 'Demande introuvable';
  end if;

  if v_req.status not in ('pending', 'approved') then
    raise exception 'Cette demande ne peut plus être modifiée';
  end if;

  if p_action = 'approve' then
    update public.driver_withdrawal_requests
    set status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        admin_note = p_admin_note
    where id = p_withdrawal_id;
    return jsonb_build_object('ok', true, 'status', 'approved');
  end if;

  if p_action = 'paid' then
    v_balance := public.driver_wallet_balance(v_req.driver_id);
    update public.driver_withdrawal_requests
    set status = 'paid',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        paid_at = now(),
        payment_reference = coalesce(p_payment_reference, payment_reference),
        admin_note = coalesce(p_admin_note, admin_note)
    where id = p_withdrawal_id;

    insert into public.driver_wallet_ledger (
      driver_id, entry_type, amount, balance_after, reference_type, reference_id, note
    ) values (
      v_req.driver_id, 'payout', v_req.amount, v_balance, 'withdrawal', v_req.id,
      'Retrait versé ' || coalesce(p_payment_reference, '')
    );

    perform public.notify_user(
      (select user_id from public.drivers where id = v_req.driver_id),
      'Retrait effectué',
      v_req.amount::text || ' FCFA ont été envoyés sur votre Mobile Money / Wave.',
      'payment',
      '/portefeuille',
      jsonb_build_object('withdrawal_id', v_req.id, 'amount', v_req.amount)
    );

    return jsonb_build_object('ok', true, 'status', 'paid');
  end if;

  if p_action = 'reject' then
    v_balance := public.driver_wallet_balance(v_req.driver_id) + v_req.amount;
    update public.driver_withdrawal_requests
    set status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        admin_note = p_admin_note
    where id = p_withdrawal_id;

    insert into public.driver_wallet_ledger (
      driver_id, entry_type, amount, balance_after, reference_type, reference_id, note
    ) values (
      v_req.driver_id, 'reversal', v_req.amount, v_balance, 'withdrawal', v_req.id,
      'Retrait rejeté — fonds restitués'
    );

    perform public.notify_user(
      (select user_id from public.drivers where id = v_req.driver_id),
      'Retrait refusé',
      coalesce(p_admin_note, 'Votre demande de retrait a été refusée. Les fonds sont de nouveau disponibles.'),
      'payment',
      '/portefeuille',
      jsonb_build_object('withdrawal_id', v_req.id)
    );

    return jsonb_build_object('ok', true, 'status', 'rejected');
  end if;

  raise exception 'Action invalide (approve|paid|reject)';
end;
$$;

-- Upsert compte de retrait livreur
create or replace function public.upsert_driver_payout_account(
  p_provider text,
  p_phone text,
  p_account_name text default null
)
returns public.driver_payout_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid;
  v_row public.driver_payout_accounts;
begin
  select id into v_driver_id
  from public.drivers
  where user_id = auth.uid() and status = 'approved';

  if v_driver_id is null then
    raise exception 'Profil livreur introuvable ou non approuvé';
  end if;

  if p_provider not in ('orange_money', 'moov_money', 'mtn_money', 'wave') then
    raise exception 'Opérateur invalide';
  end if;

  if length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 8 then
    raise exception 'Numéro invalide';
  end if;

  insert into public.driver_payout_accounts (driver_id, provider, phone, account_name)
  values (v_driver_id, p_provider, trim(p_phone), nullif(trim(p_account_name), ''))
  on conflict (driver_id) do update
    set provider = excluded.provider,
        phone = excluded.phone,
        account_name = excluded.account_name,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
alter table public.driver_payout_accounts enable row level security;
alter table public.driver_earnings enable row level security;
alter table public.driver_wallet_ledger enable row level security;
alter table public.driver_withdrawal_requests enable row level security;
alter table public.driver_rate_rules enable row level security;

drop policy if exists "Drivers manage own payout account" on public.driver_payout_accounts;
create policy "Drivers manage own payout account"
  on public.driver_payout_accounts for all
  using (
    public.is_admin()
    or exists (select 1 from public.drivers d where d.id = driver_id and d.user_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.drivers d where d.id = driver_id and d.user_id = auth.uid())
  );

drop policy if exists "Drivers read own earnings" on public.driver_earnings;
create policy "Drivers read own earnings"
  on public.driver_earnings for select
  using (
    public.is_admin()
    or exists (select 1 from public.drivers d where d.id = driver_id and d.user_id = auth.uid())
  );

drop policy if exists "Drivers read own ledger" on public.driver_wallet_ledger;
create policy "Drivers read own ledger"
  on public.driver_wallet_ledger for select
  using (
    public.is_admin()
    or exists (select 1 from public.drivers d where d.id = driver_id and d.user_id = auth.uid())
  );

drop policy if exists "Drivers read own withdrawals" on public.driver_withdrawal_requests;
create policy "Drivers read own withdrawals"
  on public.driver_withdrawal_requests for select
  using (
    public.is_admin()
    or exists (select 1 from public.drivers d where d.id = driver_id and d.user_id = auth.uid())
  );

drop policy if exists "Admins manage withdrawals" on public.driver_withdrawal_requests;
create policy "Admins manage withdrawals"
  on public.driver_withdrawal_requests for update
  using (public.is_admin());

drop policy if exists "Anyone read active rate rules" on public.driver_rate_rules;
create policy "Anyone read active rate rules"
  on public.driver_rate_rules for select
  using (active = true or public.is_admin());

drop policy if exists "Admins manage rate rules" on public.driver_rate_rules;
create policy "Admins manage rate rules"
  on public.driver_rate_rules for all
  using (public.is_admin())
  with check (public.is_admin());

revoke all on function public.credit_driver_for_delivery(uuid) from public;
grant execute on function public.credit_driver_for_delivery(uuid) to service_role;

revoke all on function public.request_driver_withdrawal(integer) from public;
grant execute on function public.request_driver_withdrawal(integer) to authenticated;

revoke all on function public.admin_review_withdrawal(uuid, text, text, text) from public;
grant execute on function public.admin_review_withdrawal(uuid, text, text, text) to authenticated;

revoke all on function public.upsert_driver_payout_account(text, text, text) from public;
grant execute on function public.upsert_driver_payout_account(text, text, text) to authenticated;

grant execute on function public.driver_wallet_balance(uuid) to authenticated;
grant execute on function public.is_driver_withdraw_window(timestamptz) to authenticated;
grant execute on function public.driver_week_key(timestamptz) to authenticated;
