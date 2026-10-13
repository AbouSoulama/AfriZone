-- AfriZone 031 — Code de confirmation à l'arrivée du livreur
-- Le livreur clique « Arrivé » → code envoyé au client (email + notification).
-- La course ne passe « livrée » qu'après saisie du code.
-- La livraison vendeur (courier_kind = vendor) n'est pas concernée.

create extension if not exists pgcrypto;

alter table public.deliveries
  add column if not exists arrived_at timestamptz;

comment on column public.deliveries.arrived_at is
  'Horodatage du clic « Arrivé » du livreur (code client envoyé)';

-- Code jamais lisible par le livreur (pas de policy : seul security definer y accède)
create table if not exists public.delivery_arrival_codes (
  delivery_id uuid primary key references public.deliveries(id) on delete cascade,
  code_hash text not null,
  salt text not null,
  attempts integer not null default 0,
  sent_at timestamptz not null default now(),
  verified_at timestamptz
);

alter table public.delivery_arrival_codes enable row level security;

create or replace function public.delivery_code_hash(p_salt text, p_code text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(convert_to(p_salt || p_code, 'utf8'), 'sha256'), 'hex');
$$;

revoke all on function public.delivery_code_hash(text, text) from public;

-- Empêche de marquer livrée sans le RPC de vérification (livreur AfriZone uniquement)
create or replace function public.deliveries_require_client_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'delivered'
     and old.status is distinct from 'delivered'
     and coalesce(new.courier_kind, 'driver') = 'driver'
     and current_setting('afrizone.delivery_confirm', true) is distinct from '1'
  then
    raise exception 'Code client requis : cliquez sur Arrivé, puis saisissez le code reçu par le client';
  end if;
  return new;
end;
$$;

drop trigger if exists deliveries_require_client_code on public.deliveries;
create trigger deliveries_require_client_code
  before update of status on public.deliveries
  for each row execute function public.deliveries_require_client_code();

-- ─── Arrivée : génère le code et le transmet au client ──────────────
create or replace function public.driver_signal_arrival(p_delivery_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_del public.deliveries%rowtype;
  v_driver_user uuid;
  v_client uuid;
  v_email text;
  v_name text;
  v_ref text;
  v_code text;
  v_salt text;
  v_link text;
  v_body text;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;

  select * into v_del from public.deliveries where id = p_delivery_id for update;
  if not found then
    raise exception 'Course introuvable';
  end if;

  select user_id into v_driver_user from public.drivers where id = v_del.driver_id;
  if v_driver_user is distinct from v_uid and not public.is_admin() then
    raise exception 'Cette course ne vous est pas assignée';
  end if;

  if coalesce(v_del.courier_kind, 'driver') <> 'driver' then
    raise exception 'Confirmation par code réservée aux livreurs AfriZone';
  end if;

  if v_del.status <> 'in_transit' then
    raise exception 'Vous devez être en route avant de signaler l''arrivée';
  end if;

  if v_del.order_id is not null then
    select o.user_id, o.order_number into v_client, v_ref
    from public.orders o where o.id = v_del.order_id;
    v_link := '/commandes/' || v_del.order_id::text;
  else
    select p.user_id, p.tracking_number into v_client, v_ref
    from public.parcel_shipments p where p.id = v_del.parcel_id;
    v_link := '/colis/' || coalesce(v_del.parcel_id::text, '');
  end if;

  if v_client is null then
    raise exception 'Client introuvable pour cette course';
  end if;

  select email, full_name into v_email, v_name
  from public.profiles where id = v_client;

  v_code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
  v_salt := encode(gen_random_bytes(16), 'hex');

  insert into public.delivery_arrival_codes (delivery_id, code_hash, salt, attempts, sent_at, verified_at)
  values (
    v_del.id,
    public.delivery_code_hash(v_salt, v_code),
    v_salt,
    0,
    now(),
    null
  )
  on conflict (delivery_id) do update set
    code_hash = excluded.code_hash,
    salt = excluded.salt,
    attempts = 0,
    sent_at = now(),
    verified_at = null;

  update public.deliveries
  set arrived_at = now()
  where id = v_del.id;

  v_body := 'Votre livreur AfriZone est arrivé'
    || case when v_ref is not null then ' (' || v_ref || ')' else '' end
    || '. Donnez-lui ce code pour confirmer la réception : ' || v_code
    || '. Ne le communiquez qu''après avoir reçu le colis.';

  perform public.notify_user(
    v_client,
    'Code de livraison',
    v_body,
    'delivery',
    v_link,
    jsonb_build_object('delivery_id', v_del.id, 'ref', v_ref)
  );

  if v_email is not null and v_email not like '%@phone.afrizone.app' then
    perform public.dispatch_platform_email(
      'delivery_arrival_code',
      'AfriZone — Code de livraison ' || coalesce(v_ref, ''),
      'Votre livreur est arrivé',
      v_body,
      v_link,
      array[v_client],
      false,
      'customer',
      v_del.order_id,
      'Voir ma commande'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'arrived_at', now(),
    'notified', true,
    'email_sent', v_email is not null and v_email not like '%@phone.afrizone.app',
    'client_name', v_name
  );
end;
$$;

revoke all on function public.driver_signal_arrival(uuid) from public;
grant execute on function public.driver_signal_arrival(uuid) to authenticated;

-- ─── Validation : le livreur saisit le code du client ───────────────
create or replace function public.driver_confirm_delivery_code(
  p_delivery_id uuid,
  p_code text,
  p_proof_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_del public.deliveries%rowtype;
  v_driver_user uuid;
  v_code_row public.delivery_arrival_codes%rowtype;
  v_code text := regexp_replace(coalesce(p_code, ''), '\s', '', 'g');
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;

  select * into v_del from public.deliveries where id = p_delivery_id for update;
  if not found then
    raise exception 'Course introuvable';
  end if;

  select user_id into v_driver_user from public.drivers where id = v_del.driver_id;
  if v_driver_user is distinct from v_uid and not public.is_admin() then
    raise exception 'Cette course ne vous est pas assignée';
  end if;

  if v_del.status = 'delivered' then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  if v_del.status <> 'in_transit' or v_del.arrived_at is null then
    raise exception 'Signalez d''abord votre arrivée pour envoyer le code au client';
  end if;

  select * into v_code_row
  from public.delivery_arrival_codes
  where delivery_id = v_del.id
  for update;

  if not found or v_code_row.verified_at is not null then
    raise exception 'Aucun code en attente. Cliquez à nouveau sur Arrivé.';
  end if;

  if v_code_row.attempts >= 5 then
    return jsonb_build_object(
      'ok', false,
      'error', 'Trop de tentatives. Renvoyez un nouveau code au client.'
    );
  end if;

  if public.delivery_code_hash(v_code_row.salt, v_code) is distinct from v_code_row.code_hash then
    update public.delivery_arrival_codes
    set attempts = attempts + 1
    where delivery_id = v_del.id;
    return jsonb_build_object(
      'ok', false,
      'error', format('Code incorrect (%s / 5)', v_code_row.attempts + 1),
      'attempts', v_code_row.attempts + 1
    );
  end if;

  update public.delivery_arrival_codes
  set verified_at = now()
  where delivery_id = v_del.id;

  perform set_config('afrizone.delivery_confirm', '1', true);

  update public.deliveries
  set
    status = 'delivered',
    delivered_at = now(),
    proof_photo_url = coalesce(nullif(trim(p_proof_url), ''), proof_photo_url),
    proof_photo_at = case
      when nullif(trim(p_proof_url), '') is not null then now()
      else proof_photo_at
    end
  where id = v_del.id;

  if v_del.order_id is not null then
    update public.orders
    set status = 'delivered', updated_at = now()
    where id = v_del.order_id
      and status is distinct from 'delivered';
  end if;

  if v_del.parcel_id is not null then
    update public.parcel_shipments
    set status = 'delivered', updated_at = now()
    where id = v_del.parcel_id
      and status is distinct from 'delivered';
  end if;

  return jsonb_build_object('ok', true, 'status', 'delivered');
end;
$$;

revoke all on function public.driver_confirm_delivery_code(uuid, text, text) from public;
grant execute on function public.driver_confirm_delivery_code(uuid, text, text) to authenticated;
