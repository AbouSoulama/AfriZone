-- AfriZone 035 — Newsletter : double opt-in + campagnes
-- Prérequis : Edge Function `order-emails` (kinds newsletter_confirm / newsletter_campaign)
-- + app_settings (supabase_url, email_hook_secret) ; optionnel app_url

create extension if not exists pgcrypto;
create extension if not exists pg_net;

-- ─── 1) Abonnés : statut + tokens ───────────────────────────────────
alter table public.newsletter_subscribers
  add column if not exists status text not null default 'pending',
  add column if not exists confirm_token text,
  add column if not exists unsubscribe_token text,
  add column if not exists confirmed_at timestamptz,
  add column if not exists unsubscribed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'newsletter_subscribers_status_check'
  ) then
    alter table public.newsletter_subscribers
      add constraint newsletter_subscribers_status_check
      check (status in ('pending', 'confirmed', 'unsubscribed'));
  end if;
end $$;

-- Abonnés déjà en base : considérés confirmés (pas de double opt-in rétroactif)
update public.newsletter_subscribers
set
  status = 'confirmed',
  confirmed_at = coalesce(confirmed_at, created_at),
  confirm_token = coalesce(confirm_token, encode(gen_random_bytes(24), 'hex')),
  unsubscribe_token = coalesce(unsubscribe_token, encode(gen_random_bytes(24), 'hex')),
  updated_at = now()
where status = 'pending'
  and confirm_token is null
  and confirmed_at is null
  and created_at < now();

-- Remplir tokens manquants
update public.newsletter_subscribers
set confirm_token = encode(gen_random_bytes(24), 'hex')
where confirm_token is null;

update public.newsletter_subscribers
set unsubscribe_token = encode(gen_random_bytes(24), 'hex')
where unsubscribe_token is null;

create unique index if not exists newsletter_subscribers_confirm_token_uidx
  on public.newsletter_subscribers (confirm_token);

create unique index if not exists newsletter_subscribers_unsub_token_uidx
  on public.newsletter_subscribers (unsubscribe_token);

create index if not exists newsletter_subscribers_status_idx
  on public.newsletter_subscribers (status);

-- Plus d'insert public direct : passage par RPC
drop policy if exists "Anyone can subscribe newsletter" on public.newsletter_subscribers;

-- ─── 2) Campagnes ───────────────────────────────────────────────────
create table if not exists public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  title text not null,
  body text not null,
  cta_url text,
  cta_label text,
  status text not null default 'draft'
    check (status in ('draft', 'sending', 'sent', 'failed')),
  created_by uuid references auth.users (id) on delete set null,
  recipient_count int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists newsletter_campaigns_created_idx
  on public.newsletter_campaigns (created_at desc);

alter table public.newsletter_campaigns enable row level security;

drop policy if exists "Admins manage newsletter campaigns" on public.newsletter_campaigns;
create policy "Admins manage newsletter campaigns"
  on public.newsletter_campaigns for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.newsletter_campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.newsletter_campaigns (id) on delete cascade,
  subscriber_id uuid references public.newsletter_subscribers (id) on delete set null,
  email text not null,
  success boolean not null default false,
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists newsletter_campaign_sends_campaign_idx
  on public.newsletter_campaign_sends (campaign_id);

alter table public.newsletter_campaign_sends enable row level security;

drop policy if exists "Admins read newsletter sends" on public.newsletter_campaign_sends;
create policy "Admins read newsletter sends"
  on public.newsletter_campaign_sends for select to authenticated
  using (public.is_admin());

-- ─── 3) Helpers dispatch ────────────────────────────────────────────
create or replace function public.dispatch_newsletter_email(p_body jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_secret text;
  v_url text;
begin
  v_base := trim(trailing '/' from coalesce(public.app_setting('supabase_url'), ''));
  v_secret := coalesce(public.app_setting('email_hook_secret'), '');

  if v_base = '' or v_secret = '' then
    raise notice 'dispatch_newsletter_email: app_settings manquants — email ignoré';
    return;
  end if;

  v_url := v_base || '/functions/v1/order-emails';

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-email-hook-secret', v_secret
    ),
    body := p_body
  );
exception
  when others then
    raise notice 'dispatch_newsletter_email failed: %', SQLERRM;
end;
$$;

revoke all on function public.dispatch_newsletter_email(jsonb) from public;

create or replace function public.newsletter_app_url()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select trim(trailing '/' from coalesce(
    nullif(public.app_setting('app_url'), ''),
    'https://afrizones.com'
  ));
$$;

revoke all on function public.newsletter_app_url() from public;

-- ─── 4) Inscription (pending + e-mail de confirmation) ───────────────
create or replace function public.subscribe_newsletter(
  p_email text,
  p_country text default null,
  p_source text default 'footer'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_country text := nullif(upper(trim(coalesce(p_country, ''))), '');
  v_source text := coalesce(nullif(trim(p_source), ''), 'footer');
  v_row public.newsletter_subscribers%rowtype;
  v_confirm text;
  v_unsub text;
  v_app text;
begin
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email invalide';
  end if;

  select * into v_row
  from public.newsletter_subscribers
  where email = v_email;

  if found and v_row.status = 'confirmed' then
    return jsonb_build_object(
      'ok', true,
      'email', v_email,
      'status', 'already_confirmed'
    );
  end if;

  v_confirm := encode(gen_random_bytes(24), 'hex');
  v_unsub := encode(gen_random_bytes(24), 'hex');

  if found then
    update public.newsletter_subscribers
    set
      status = 'pending',
      country = coalesce(v_country, country),
      source = v_source,
      confirm_token = v_confirm,
      unsubscribe_token = coalesce(unsubscribe_token, v_unsub),
      confirmed_at = null,
      unsubscribed_at = null,
      updated_at = now()
    where id = v_row.id
    returning * into v_row;
  else
    insert into public.newsletter_subscribers (
      email, country, source, status, confirm_token, unsubscribe_token
    ) values (
      v_email, v_country, v_source, 'pending', v_confirm, v_unsub
    )
    returning * into v_row;
  end if;

  v_app := public.newsletter_app_url();

  perform public.dispatch_newsletter_email(jsonb_build_object(
    'kind', 'newsletter_confirm',
    'email', v_email,
    'confirm_url', v_app || '/newsletter/confirmer?token=' || v_row.confirm_token,
    'unsubscribe_url', v_app || '/newsletter/desabonnement?token=' || v_row.unsubscribe_token
  ));

  return jsonb_build_object(
    'ok', true,
    'email', v_email,
    'status', 'pending'
  );
end;
$$;

grant execute on function public.subscribe_newsletter(text, text, text) to anon, authenticated;

-- ─── 5) Confirmer / désabonner ──────────────────────────────────────
create or replace function public.confirm_newsletter(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := lower(trim(p_token));
  v_row public.newsletter_subscribers%rowtype;
begin
  if v_token is null or length(v_token) < 16 then
    raise exception 'Lien de confirmation invalide';
  end if;

  select * into v_row
  from public.newsletter_subscribers
  where confirm_token = v_token;

  if not found then
    raise exception 'Lien de confirmation invalide ou expiré';
  end if;

  if v_row.status = 'confirmed' then
    return jsonb_build_object('ok', true, 'email', v_row.email, 'status', 'already_confirmed');
  end if;

  if v_row.status = 'unsubscribed' then
    raise exception 'Cette adresse est désabonnée. Réinscrivez-vous depuis le site.';
  end if;

  update public.newsletter_subscribers
  set
    status = 'confirmed',
    confirmed_at = now(),
    updated_at = now()
  where id = v_row.id;

  return jsonb_build_object('ok', true, 'email', v_row.email, 'status', 'confirmed');
end;
$$;

grant execute on function public.confirm_newsletter(text) to anon, authenticated;

create or replace function public.unsubscribe_newsletter(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := lower(trim(p_token));
  v_row public.newsletter_subscribers%rowtype;
begin
  if v_token is null or length(v_token) < 16 then
    raise exception 'Lien de désabonnement invalide';
  end if;

  select * into v_row
  from public.newsletter_subscribers
  where unsubscribe_token = v_token;

  if not found then
    raise exception 'Lien de désabonnement invalide';
  end if;

  if v_row.status = 'unsubscribed' then
    return jsonb_build_object('ok', true, 'email', v_row.email, 'status', 'already_unsubscribed');
  end if;

  update public.newsletter_subscribers
  set
    status = 'unsubscribed',
    unsubscribed_at = now(),
    updated_at = now()
  where id = v_row.id;

  return jsonb_build_object('ok', true, 'email', v_row.email, 'status', 'unsubscribed');
end;
$$;

grant execute on function public.unsubscribe_newsletter(text) to anon, authenticated;

-- ─── 6) Campagne admin ──────────────────────────────────────────────
create or replace function public.admin_send_newsletter_campaign(
  p_subject text,
  p_title text,
  p_body text,
  p_cta_url text default null,
  p_cta_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  if coalesce(trim(p_subject), '') = '' or coalesce(trim(p_title), '') = ''
     or coalesce(trim(p_body), '') = '' then
    raise exception 'Sujet, titre et message sont requis';
  end if;

  select count(*)::int into v_count
  from public.newsletter_subscribers
  where status = 'confirmed';

  if v_count = 0 then
    raise exception 'Aucun abonné confirmé pour l''instant';
  end if;

  insert into public.newsletter_campaigns (
    subject, title, body, cta_url, cta_label, status, created_by, recipient_count
  ) values (
    trim(p_subject),
    trim(p_title),
    trim(p_body),
    nullif(trim(coalesce(p_cta_url, '')), ''),
    nullif(trim(coalesce(p_cta_label, '')), ''),
    'sending',
    auth.uid(),
    v_count
  )
  returning id into v_id;

  perform public.dispatch_newsletter_email(jsonb_build_object(
    'kind', 'newsletter_campaign',
    'campaign_id', v_id
  ));

  return jsonb_build_object(
    'ok', true,
    'campaign_id', v_id,
    'recipient_count', v_count
  );
end;
$$;

grant execute on function public.admin_send_newsletter_campaign(text, text, text, text, text)
  to authenticated;

-- Mise à jour des compteurs depuis l'Edge (service role)
create or replace function public.admin_finalize_newsletter_campaign(
  p_campaign_id uuid,
  p_sent int,
  p_failed int,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.newsletter_campaigns
  set
    sent_count = greatest(coalesce(p_sent, 0), 0),
    failed_count = greatest(coalesce(p_failed, 0), 0),
    status = case
      when coalesce(p_error, '') <> '' and coalesce(p_sent, 0) = 0 then 'failed'
      else 'sent'
    end,
    error = nullif(trim(coalesce(p_error, '')), ''),
    sent_at = now()
  where id = p_campaign_id;
end;
$$;

revoke all on function public.admin_finalize_newsletter_campaign(uuid, int, int, text) from public;
