-- AfriZone 036 — Dispatch e-mails vers API Hostinger (plus via Edge order-emails)
-- Prérequis : API VPS /api/emails/dispatch + EMAIL_HOOK_SECRET identique

create or replace function public.newsletter_dispatch_url()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(public.app_setting('email_dispatch_url')), ''),
    'https://afrizones.com/api/emails/dispatch'
  );
$$;

revoke all on function public.newsletter_dispatch_url() from public;

create or replace function public.dispatch_newsletter_email(p_body jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  v_url := public.newsletter_dispatch_url();
  v_secret := coalesce(public.app_setting('email_hook_secret'), '');

  if v_url = '' or v_secret = '' then
    raise notice 'dispatch_newsletter_email: config manquante — email ignoré';
    return;
  end if;

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

create or replace function public.dispatch_platform_email(
  p_event text,
  p_subject text,
  p_title text,
  p_body text,
  p_link text default null,
  p_user_ids uuid[] default null,
  p_to_admins boolean default false,
  p_role text default 'user',
  p_order_id uuid default null,
  p_cta_label text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  if coalesce(trim(p_subject), '') = '' or coalesce(trim(p_body), '') = '' then
    return;
  end if;
  if (p_user_ids is null or array_length(p_user_ids, 1) is null) and not coalesce(p_to_admins, false) then
    return;
  end if;

  v_url := public.newsletter_dispatch_url();
  v_secret := coalesce(public.app_setting('email_hook_secret'), '');

  if v_url = '' or v_secret = '' then
    raise notice 'dispatch_platform_email: config manquante — email ignoré';
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-email-hook-secret', v_secret
    ),
    body := jsonb_build_object(
      'kind', 'generic',
      'event', p_event,
      'subject', p_subject,
      'title', p_title,
      'body', p_body,
      'link', p_link,
      'cta_label', p_cta_label,
      'role', coalesce(p_role, 'user'),
      'user_ids', to_jsonb(coalesce(p_user_ids, '{}'::uuid[])),
      'to_admins', coalesce(p_to_admins, false),
      'order_id', p_order_id
    )
  );
exception
  when others then
    raise notice 'dispatch_platform_email failed: %', SQLERRM;
end;
$$;

create or replace function public.dispatch_order_email(
  p_order_id uuid,
  p_event text,
  p_status text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  if p_order_id is null then
    return;
  end if;

  v_url := public.newsletter_dispatch_url();
  v_secret := coalesce(public.app_setting('email_hook_secret'), '');

  if v_url = '' or v_secret = '' then
    raise notice 'dispatch_order_email: config manquante — email ignoré';
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-email-hook-secret', v_secret
    ),
    body := jsonb_build_object(
      'order_id', p_order_id,
      'event', coalesce(p_event, 'purchase'),
      'status', p_status
    )
  );
exception
  when others then
    raise notice 'dispatch_order_email failed: %', SQLERRM;
end;
$$;

insert into public.app_settings (key, value)
values ('email_dispatch_url', 'https://afrizones.com/api/emails/dispatch')
on conflict (key) do update set value = excluded.value;
