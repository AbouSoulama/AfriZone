-- AfriZone Module 7 — Adresses : updated_at + 1 adresse par défaut max
-- Exécuter dans Supabase SQL Editor

drop trigger if exists addresses_updated_at on public.addresses;
create trigger addresses_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

-- Quand une adresse devient défaut, retirer le défaut des autres du même user
create or replace function public.ensure_single_default_address()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_default = true then
    update public.addresses
    set is_default = false
    where user_id = new.user_id
      and id <> new.id
      and is_default = true;
  end if;
  return new;
end;
$$;

drop trigger if exists addresses_single_default on public.addresses;
create trigger addresses_single_default
  before insert or update of is_default on public.addresses
  for each row
  when (new.is_default = true)
  execute function public.ensure_single_default_address();
