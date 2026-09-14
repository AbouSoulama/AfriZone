-- AfriZone 024 — Preuve photo, lots groupés tarifés, SLA 2h, commission 10%

-- ─── 1) Preuve de livraison ─────────────────────────────────────────
alter table public.deliveries
  add column if not exists proof_photo_url text,
  add column if not exists proof_photo_at timestamptz;

insert into storage.buckets (id, name, public)
values ('delivery-proofs', 'delivery-proofs', true)
on conflict (id) do nothing;

drop policy if exists "Drivers upload delivery proofs" on storage.objects;
create policy "Drivers upload delivery proofs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'delivery-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Delivery proofs public read" on storage.objects;
create policy "Delivery proofs public read"
  on storage.objects for select
  using (bucket_id = 'delivery-proofs');

drop policy if exists "Drivers update own delivery proofs" on storage.objects;
create policy "Drivers update own delivery proofs"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'delivery-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── 2) Lots groupés avec prix fixe ─────────────────────────────────
create table if not exists public.delivery_batches (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references public.drivers(id) on delete set null,
  offered_fee integer not null check (offered_fee >= 0),
  status text not null default 'offered'
    check (status in ('offered', 'accepted', 'refused', 'cancelled', 'in_progress', 'completed')),
  assigned_by uuid references public.profiles(id) on delete set null,
  notes text,
  accept_deadline_at timestamptz not null default (now() + interval '2 hours'),
  start_deadline_at timestamptz,
  accepted_at timestamptz,
  refused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists delivery_batches_driver_idx on public.delivery_batches(driver_id);
create index if not exists delivery_batches_status_idx on public.delivery_batches(status);

alter table public.deliveries
  add column if not exists batch_id uuid references public.delivery_batches(id) on delete set null,
  add column if not exists offered_fee integer,
  add column if not exists accept_deadline_at timestamptz,
  add column if not exists start_deadline_at timestamptz;

create index if not exists deliveries_batch_id_idx on public.deliveries(batch_id);

alter table public.delivery_batches enable row level security;

drop policy if exists "Batches readable by stakeholders" on public.delivery_batches;
create policy "Batches readable by stakeholders"
  on public.delivery_batches for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.drivers d
      where d.id = delivery_batches.driver_id and d.user_id = auth.uid()
    )
  );

drop policy if exists "Admin manage batches" on public.delivery_batches;
create policy "Admin manage batches"
  on public.delivery_batches for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ─── 3) Créer un lot (plusieurs commandes + prix) ───────────────────
create or replace function public.admin_create_delivery_batch(
  p_driver_id uuid,
  p_order_ids uuid[],
  p_offered_fee integer,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_oid uuid;
  v_order public.orders%rowtype;
  v_admin uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'Admin requis';
  end if;
  if p_driver_id is null then
    raise exception 'Livreur requis';
  end if;
  if p_order_ids is null or array_length(p_order_ids, 1) is null then
    raise exception 'Au moins une commande';
  end if;
  if p_offered_fee is null or p_offered_fee < 0 then
    raise exception 'Prix de livraison invalide';
  end if;

  insert into public.delivery_batches (
    driver_id, offered_fee, status, assigned_by, notes, accept_deadline_at
  ) values (
    p_driver_id, p_offered_fee, 'offered', v_admin, p_notes, now() + interval '2 hours'
  )
  returning id into v_batch_id;

  foreach v_oid in array p_order_ids loop
    select * into v_order from public.orders where id = v_oid;
    if not found then
      raise exception 'Commande introuvable: %', v_oid;
    end if;

    if exists (
      select 1 from public.deliveries
      where order_id = v_oid
        and status not in ('refused', 'cancelled', 'delivered')
    ) then
      raise exception 'Commande déjà en course: %', v_order.order_number;
    end if;

    insert into public.deliveries (
      driver_id, order_id, vendor_id, courier_kind, status,
      pickup_address, pickup_city, delivery_address, delivery_city,
      delivery_lat, delivery_lng, recipient_phone, assigned_by,
      batch_id, offered_fee, accept_deadline_at
    ) values (
      p_driver_id, v_oid, v_order.vendor_id, 'driver', 'assigned',
      'Entrepôt / vendeur AfriZone', v_order.shipping_city,
      v_order.shipping_address, v_order.shipping_city,
      v_order.shipping_lat, v_order.shipping_lng, v_order.shipping_phone, v_admin,
      v_batch_id, p_offered_fee, now() + interval '2 hours'
    );

    if v_order.status in ('confirmed', 'processing') then
      update public.orders set status = 'processing' where id = v_oid;
    end if;
  end loop;

  perform public.notify_user(
    (select user_id from public.drivers where id = p_driver_id),
    'Nouvelle course groupée',
    'AfriZone vous propose ' || array_length(p_order_ids, 1)::text ||
      ' livraison(s) pour ' || p_offered_fee::text || ' FCFA. Accepter sous 2 h.',
    'delivery',
    '/courses',
    jsonb_build_object('batch_id', v_batch_id, 'fee', p_offered_fee)
  );

  return v_batch_id;
end;
$$;

grant execute on function public.admin_create_delivery_batch(uuid, uuid[], integer, text) to authenticated;

-- ─── 4) Accepter / refuser un lot ────────────────────────────────────
create or replace function public.driver_respond_batch(
  p_batch_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.delivery_batches%rowtype;
  v_uid uuid := auth.uid();
begin
  select * into v_batch from public.delivery_batches where id = p_batch_id for update;
  if not found then raise exception 'Lot introuvable'; end if;

  if not exists (
    select 1 from public.drivers d
    where d.id = v_batch.driver_id and d.user_id = v_uid
  ) and not public.is_admin() then
    raise exception 'Non autorisé';
  end if;

  if v_batch.status <> 'offered' then
    raise exception 'Ce lot n''est plus en attente';
  end if;

  if p_accept then
    if v_batch.accept_deadline_at < now() then
      raise exception 'Délai de 2 h dépassé — contactez l''admin';
    end if;
    update public.delivery_batches
    set status = 'accepted',
        accepted_at = now(),
        start_deadline_at = now() + interval '2 hours',
        updated_at = now()
    where id = p_batch_id;

    update public.deliveries
    set status = 'accepted',
        accepted_at = now(),
        start_deadline_at = now() + interval '2 hours'
    where batch_id = p_batch_id and status = 'assigned';
  else
    update public.delivery_batches
    set status = 'refused', refused_at = now(), updated_at = now()
    where id = p_batch_id;

    update public.deliveries
    set status = 'refused'
    where batch_id = p_batch_id and status = 'assigned';
  end if;
end;
$$;

grant execute on function public.driver_respond_batch(uuid, boolean) to authenticated;

-- ─── 5) Admin retire un lot / courses en retard (SLA 2h) ────────────
create or replace function public.admin_reclaim_overdue_deliveries(
  p_batch_id uuid default null,
  p_delivery_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin requis';
  end if;

  if p_batch_id is not null then
    update public.deliveries
    set status = 'cancelled', driver_id = null, batch_id = null
    where batch_id = p_batch_id
      and status in ('assigned', 'accepted');
    get diagnostics v_count = row_count;

    update public.delivery_batches
    set status = 'cancelled', updated_at = now()
    where id = p_batch_id and status in ('offered', 'accepted', 'in_progress');
    return v_count;
  end if;

  if p_delivery_id is not null then
    update public.deliveries
    set status = 'cancelled', driver_id = null
    where id = p_delivery_id
      and status in ('assigned', 'accepted')
      and (
        (status = 'assigned' and coalesce(accept_deadline_at, assigned_at + interval '2 hours') < now())
        or (status = 'accepted' and coalesce(start_deadline_at, accepted_at + interval '2 hours') < now())
        or true -- admin peut toujours retirer
      );
    get diagnostics v_count = row_count;
    return v_count;
  end if;

  -- Tous les retards
  update public.deliveries
  set status = 'cancelled', driver_id = null
  where (
    (status = 'assigned' and coalesce(accept_deadline_at, assigned_at + interval '2 hours') < now())
    or (status = 'accepted' and coalesce(start_deadline_at, accepted_at + interval '2 hours') < now()
        and status not in ('picked_up', 'in_transit', 'delivered'))
  )
  and status in ('assigned', 'accepted');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.admin_reclaim_overdue_deliveries(uuid, uuid) to authenticated;

-- Vue helper overdue
create or replace function public.is_delivery_overdue(p_delivery_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.deliveries d
    where d.id = p_delivery_id
      and (
        (d.status = 'assigned' and coalesce(d.accept_deadline_at, d.assigned_at + interval '2 hours') < now())
        or (d.status = 'accepted' and coalesce(d.start_deadline_at, d.accepted_at + interval '2 hours') < now())
      )
  );
$$;

grant execute on function public.is_delivery_overdue(uuid) to authenticated;

-- ─── 6) Crédit portefeuille = offered_fee du lot (une fois) ──────────
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
  v_batch public.delivery_batches%rowtype;
  v_remaining integer;
begin
  select * into v_del from public.deliveries where id = p_delivery_id for update;
  if not found then raise exception 'Course introuvable'; end if;
  if v_del.status is distinct from 'delivered' then
    raise exception 'La course n''est pas livrée';
  end if;
  if v_del.driver_id is null then
    raise exception 'Aucun livreur assigné';
  end if;
  if exists (select 1 from public.driver_earnings where delivery_id = p_delivery_id) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  -- Lot groupé : créditer le prix fixe UNE fois (sur la dernière livraison du lot)
  if v_del.batch_id is not null then
    select * into v_batch from public.delivery_batches where id = v_del.batch_id for update;

    select count(*) into v_remaining
    from public.deliveries
    where batch_id = v_del.batch_id
      and status not in ('delivered', 'refused', 'cancelled')
      and id is distinct from p_delivery_id;

    if v_remaining > 0 then
      -- Pas encore toutes livrées : pas de crédit global
      return jsonb_build_object('ok', true, 'pending_batch', true, 'remaining', v_remaining);
    end if;

    -- Déjà crédité via une autre course du lot ?
    if exists (
      select 1 from public.driver_earnings e
      join public.deliveries d on d.id = e.delivery_id
      where d.batch_id = v_del.batch_id
    ) then
      return jsonb_build_object('ok', true, 'already', true);
    end if;

    v_net := coalesce(v_batch.offered_fee, v_del.offered_fee, 0);
    update public.delivery_batches
    set status = 'completed', updated_at = now()
    where id = v_del.batch_id;
  else
    v_net := coalesce(
      v_del.offered_fee,
      public.compute_delivery_earning(v_del.pickup_city, v_del.delivery_city)
    );
  end if;

  if v_net <= 0 then
    return jsonb_build_object('ok', true, 'amount', 0);
  end if;

  v_balance := public.driver_wallet_balance(v_del.driver_id) + v_net;

  insert into public.driver_earnings (
    driver_id, delivery_id, gross_amount, bonus_amount, penalty_amount, net_amount, note
  ) values (
    v_del.driver_id, p_delivery_id, v_net, 0, 0, v_net,
    case when v_del.batch_id is not null
      then 'Gain lot groupé'
      else 'Gain course ' || coalesce(v_del.pickup_city, '') || ' → ' || coalesce(v_del.delivery_city, '')
    end
  )
  returning id into v_earning_id;

  insert into public.driver_wallet_ledger (
    driver_id, entry_type, amount, balance_after, reference_type, reference_id, note
  ) values (
    v_del.driver_id, 'credit', v_net, v_balance, 'earning', v_earning_id, 'Crédit livraison'
  )
  returning id into v_ledger_id;

  perform public.notify_user(
    (select user_id from public.drivers where id = v_del.driver_id),
    'Gain crédité',
    v_net::text || ' FCFA ont été ajoutés à votre portefeuille AfriZone.',
    'payment',
    '/portefeuille',
    jsonb_build_object('earning_id', v_earning_id, 'amount', v_net, 'delivery_id', p_delivery_id)
  );

  return jsonb_build_object(
    'ok', true, 'already', false,
    'earning_id', v_earning_id, 'amount', v_net, 'balance', v_balance
  );
end;
$$;

-- ─── 7) Commission plateforme 10% ───────────────────────────────────
insert into public.app_settings (key, value)
values ('vendor_commission_rate', '0.10')
on conflict (key) do update set value = excluded.value;

alter table public.order_items
  add column if not exists platform_fee numeric,
  add column if not exists vendor_net numeric;

comment on column public.order_items.platform_fee is 'Commission AfriZone (ex. 10% du line total)';
comment on column public.order_items.vendor_net is 'Net vendeur après commission';
