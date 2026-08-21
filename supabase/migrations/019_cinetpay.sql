-- AfriZone — Paiements CinetPay
-- Sessions de paiement + e-mails d'achat uniquement après encaissement réel.

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  transaction_id text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('order', 'parcel')),
  amount integer not null check (amount >= 100),
  currency text not null default 'XOF',
  provider text not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'cancelled')),
  order_ids uuid[] not null default '{}',
  parcel_id uuid references public.parcel_shipments(id) on delete set null,
  payment_url text,
  operator_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_intents_user_idx on public.payment_intents(user_id);
create index if not exists payment_intents_status_idx on public.payment_intents(status);

alter table public.payment_intents enable row level security;

drop policy if exists "Users read own payment intents" on public.payment_intents;
create policy "Users read own payment intents"
  on public.payment_intents for select
  using (user_id = auth.uid());

drop policy if exists "Users insert own payment intents" on public.payment_intents;
create policy "Users insert own payment intents"
  on public.payment_intents for insert
  with check (user_id = auth.uid());

drop policy if exists "Admins read payment intents" on public.payment_intents;
create policy "Admins read payment intents"
  on public.payment_intents for select
  using (public.is_admin());

-- E-mail / notif « nouvel achat » uniquement si le paiement est déjà encaissé
-- (le parcours CinetPay crée d'abord une commande pending/unpaid).
create or replace function public.notify_on_order_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.payment_status, '') <> 'paid' then
    return new;
  end if;

  if new.user_id is not null then
    perform public.notify_user(
      new.user_id,
      'Paiement confirmé',
      'Votre commande ' || new.order_number || ' a été payée et confirmée.',
      'order',
      '/commandes/' || new.id::text,
      jsonb_build_object('order_id', new.id, 'status', new.status)
    );
  end if;

  perform public.notify_admins(
    'Nouvel achat',
    'Commande ' || new.order_number || ' — ' || new.total::text || ' FCFA (' ||
      public.order_status_label(new.status::text) || ')',
    'order',
    '/admin/commandes',
    jsonb_build_object('order_id', new.id, 'order_number', new.order_number, 'status', new.status)
  );

  perform public.dispatch_order_email(new.id, 'purchase', new.status::text);

  return new;
end;
$$;

-- Confirmation CinetPay (appelée par l'Edge Function, service_role).
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
      'parcel_id', v_intent.parcel_id
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

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'kind', v_intent.kind,
    'order_ids', to_jsonb(v_intent.order_ids),
    'parcel_id', v_intent.parcel_id,
    'orders_updated', v_orders,
    'parcels_updated', v_parcels
  );
end;
$$;

revoke all on function public.complete_cinetpay_payment(text, text) from public;
grant execute on function public.complete_cinetpay_payment(text, text) to service_role;
