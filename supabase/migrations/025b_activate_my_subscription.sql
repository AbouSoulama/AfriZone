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
    raise exception 'Non authentifié';
  end if;
  select user_id, status into v_owner, v_status
  from public.subscriptions where id = p_subscription_id;
  if not found then raise exception 'Abonnement introuvable'; end if;
  if v_owner <> v_uid and not public.is_admin() then
    raise exception 'Accès refusé';
  end if;
  if v_status not in ('pending', 'active') then
    raise exception 'Statut invalide';
  end if;
  return public.activate_subscription(p_subscription_id);
end;
$$;

grant execute on function public.activate_my_pending_subscription(uuid) to authenticated;
