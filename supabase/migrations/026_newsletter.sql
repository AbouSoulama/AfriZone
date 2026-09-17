-- AfriZone 026 — Newsletter footer

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  country text,
  source text not null default 'footer',
  created_at timestamptz not null default now(),
  constraint newsletter_subscribers_email_unique unique (email)
);

create index if not exists newsletter_subscribers_created_idx
  on public.newsletter_subscribers(created_at desc);

alter table public.newsletter_subscribers enable row level security;

drop policy if exists "Anyone can subscribe newsletter" on public.newsletter_subscribers;
create policy "Anyone can subscribe newsletter"
  on public.newsletter_subscribers for insert
  with check (true);

drop policy if exists "Admins read newsletter" on public.newsletter_subscribers;
create policy "Admins read newsletter"
  on public.newsletter_subscribers for select to authenticated
  using (public.is_admin());

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
begin
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email invalide';
  end if;

  insert into public.newsletter_subscribers (email, country, source)
  values (v_email, nullif(upper(trim(coalesce(p_country, ''))), ''), coalesce(nullif(trim(p_source), ''), 'footer'))
  on conflict (email) do update
    set country = coalesce(excluded.country, newsletter_subscribers.country);

  return jsonb_build_object('ok', true, 'email', v_email);
end;
$$;

grant execute on function public.subscribe_newsletter(text, text, text) to anon, authenticated;
