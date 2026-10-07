-- AfriZone 030 — Emails plateforme (admin, vendeur, client, livreur)
-- Prérequis : Edge Function `order-emails` redéployée (mode generic + vendeur)
-- + app_settings (supabase_url, email_hook_secret) + secrets Resend

-- ─── 1) Dispatch générique vers order-emails ────────────────────────
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
  v_base text;
  v_secret text;
  v_url text;
begin
  if coalesce(trim(p_subject), '') = '' or coalesce(trim(p_body), '') = '' then
    return;
  end if;
  if (p_user_ids is null or array_length(p_user_ids, 1) is null) and not coalesce(p_to_admins, false) then
    return;
  end if;

  v_base := trim(trailing '/' from coalesce(public.app_setting('supabase_url'), ''));
  v_secret := coalesce(public.app_setting('email_hook_secret'), '');

  if v_base = '' or v_secret = '' then
    raise notice 'dispatch_platform_email: app_settings manquants — email ignoré';
    return;
  end if;

  v_url := v_base || '/functions/v1/order-emails';

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

revoke all on function public.dispatch_platform_email(text, text, text, text, text, uuid[], boolean, text, uuid, text) from public;

-- ─── 2) Commandes : insert payé + paiement → paid + statut ──────────
-- Restaure notif vendeur (retirée en 019) + e-mails client/vendeur/admin.

create or replace function public.notify_on_order_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_user uuid;
begin
  -- Parcours live : commande créée unpaid → pas d'email achat ici
  if coalesce(new.payment_status, '') <> 'paid' then
    return new;
  end if;

  select user_id into v_vendor_user from public.vendors where id = new.vendor_id;

  if v_vendor_user is not null then
    perform public.notify_user(
      v_vendor_user,
      'Nouvelle commande',
      'Commande ' || new.order_number || ' — ' || new.total::text || ' FCFA',
      'order',
      '/vendeur/commandes/' || new.id::text,
      jsonb_build_object('order_id', new.id, 'order_number', new.order_number)
    );
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

-- Quand le paiement passe à paid (FedaPay / CinetPay)
create or replace function public.notify_on_order_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_user uuid;
begin
  if coalesce(new.payment_status, '') <> 'paid' then
    return new;
  end if;
  if coalesce(old.payment_status, '') = 'paid' then
    return new;
  end if;

  select user_id into v_vendor_user from public.vendors where id = new.vendor_id;

  if v_vendor_user is not null then
    perform public.notify_user(
      v_vendor_user,
      'Nouvelle commande',
      'Commande ' || new.order_number || ' — ' || new.total::text || ' FCFA (payée)',
      'order',
      '/vendeur/commandes/' || new.id::text,
      jsonb_build_object('order_id', new.id, 'order_number', new.order_number)
    );
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
    'Commande ' || new.order_number || ' — ' || new.total::text || ' FCFA (payée)',
    'order',
    '/admin/commandes',
    jsonb_build_object('order_id', new.id, 'order_number', new.order_number)
  );

  -- Email « purchase » (client + vendeur + admin) même si le statut change en parallèle
  perform public.dispatch_order_email(new.id, 'purchase', new.status::text);

  return new;
end;
$$;

drop trigger if exists orders_notify_paid on public.orders;
create trigger orders_notify_paid
  after update of payment_status on public.orders
  for each row execute function public.notify_on_order_paid();

create or replace function public.notify_on_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
  v_vendor_user uuid;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  v_label := public.order_status_label(new.status::text);
  select user_id into v_vendor_user from public.vendors where id = new.vendor_id;

  if new.user_id is not null then
    perform public.notify_user(
      new.user_id,
      'Mise à jour commande',
      'Commande ' || new.order_number || ' : ' || v_label,
      'order',
      '/commandes/' || new.id::text,
      jsonb_build_object('order_id', new.id, 'status', new.status)
    );
  end if;

  if v_vendor_user is not null then
    perform public.notify_user(
      v_vendor_user,
      'Statut commande',
      'Commande ' || new.order_number || ' : ' || v_label,
      'order',
      '/vendeur/commandes/' || new.id::text,
      jsonb_build_object('order_id', new.id, 'status', new.status)
    );
  end if;

  perform public.notify_admins(
    'Commande mise à jour',
    'Commande ' || new.order_number || ' → ' || v_label,
    'order',
    '/admin/commandes',
    jsonb_build_object('order_id', new.id, 'order_number', new.order_number, 'status', new.status)
  );

  if new.status::text in (
    'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
  ) then
    -- Évite le double e-mail « purchase » si payment vient juste de passer à paid
    -- et status → confirmed dans le même UPDATE : le trigger paid gère purchase.
    if not (
      coalesce(old.payment_status, '') is distinct from coalesce(new.payment_status, '')
      and coalesce(new.payment_status, '') = 'paid'
      and new.status::text = 'confirmed'
    ) then
      perform public.dispatch_order_email(new.id, 'status_update', new.status::text);
    end if;
  end if;

  return new;
end;
$$;

-- ─── 3) Colis → e-mail client (+ admin à la création) ───────────────
create or replace function public.notify_on_parcel_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    perform public.notify_user(
      new.user_id,
      'Colis enregistré',
      'Suivi ' || new.tracking_number || ' — ' || new.pickup_city || ' → ' || new.delivery_city,
      'parcel',
      '/colis/' || new.id::text,
      jsonb_build_object('parcel_id', new.id, 'tracking', new.tracking_number)
    );
    perform public.dispatch_platform_email(
      'parcel_created',
      'AfriZone — Colis ' || new.tracking_number,
      'Colis enregistré',
      'Votre colis ' || new.tracking_number || ' a été enregistré (' ||
        new.pickup_city || ' → ' || new.delivery_city || '). Montant : ' ||
        coalesce(new.price::text, '0') || ' FCFA.',
      '/colis/' || new.id::text,
      array[new.user_id],
      false,
      'customer',
      null,
      'Suivre mon colis'
    );
  end if;

  perform public.notify_admins(
    'Nouveau colis',
    new.tracking_number || ' — ' || new.pickup_city || ' → ' || new.delivery_city,
    'parcel',
    '/admin/colis',
    jsonb_build_object('parcel_id', new.id, 'tracking', new.tracking_number)
  );
  perform public.dispatch_platform_email(
    'parcel_created_admin',
    '[Admin] Nouveau colis ' || new.tracking_number,
    'Nouveau colis',
    'Colis ' || new.tracking_number || ' — ' || new.pickup_city || ' → ' || new.delivery_city ||
      ' · ' || coalesce(new.price::text, '0') || ' FCFA.',
    '/admin/colis',
    null,
    true,
    'admin',
    null,
    'Ouvrir les colis'
  );

  return new;
end;
$$;

create or replace function public.notify_on_parcel_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  if new.status is not distinct from old.status or new.user_id is null then
    return new;
  end if;

  v_label := case new.status::text
    when 'received' then 'Enregistré'
    when 'pickup_scheduled' then 'Enlèvement planifié'
    when 'collected' then 'Collecté'
    when 'in_transit' then 'En transit'
    when 'out_for_delivery' then 'En cours de livraison'
    when 'delivered' then 'Livré'
    when 'cancelled' then 'Annulé'
    else new.status::text
  end;

  perform public.notify_user(
    new.user_id,
    'Suivi colis',
    new.tracking_number || ' : ' || v_label,
    'parcel',
    '/suivi?n=' || new.tracking_number,
    jsonb_build_object('parcel_id', new.id, 'status', new.status)
  );

  perform public.dispatch_platform_email(
    'parcel_status',
    'AfriZone — Colis ' || new.tracking_number || ' : ' || v_label,
    'Mise à jour colis',
    'Votre colis ' || new.tracking_number || ' est maintenant : ' || v_label || '.',
    '/suivi?n=' || new.tracking_number,
    array[new.user_id],
    false,
    'customer',
    null,
    'Voir le suivi'
  );

  return new;
end;
$$;

-- ─── 4) Vendeur : statut boutique + candidature admin ───────────────
create or replace function public.notify_on_vendor_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body text;
  v_link text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'approved' then
    v_title := 'Boutique approuvée';
    v_body := 'Votre boutique « ' || new.shop_name || ' » est validée. Vous pouvez vendre.';
    v_link := '/vendeur';
  elsif new.status = 'rejected' then
    v_title := 'Boutique refusée';
    v_body := coalesce(new.rejection_reason, 'Votre candidature vendeur a été refusée.');
    v_link := '/auth/register/vendor';
  elsif new.status = 'suspended' then
    v_title := 'Boutique suspendue';
    v_body := 'Votre boutique a été suspendue. Contactez le support.';
    v_link := null;
  else
    return new;
  end if;

  perform public.notify_user(
    new.user_id, v_title, v_body, 'account', v_link,
    jsonb_build_object('vendor_id', new.id, 'status', new.status)
  );

  perform public.dispatch_platform_email(
    'vendor_status',
    'AfriZone — ' || v_title,
    v_title,
    v_body,
    v_link,
    array[new.user_id],
    false,
    'vendor',
    null,
    case when v_link is null then null else 'Ouvrir mon espace' end
  );

  return new;
end;
$$;

create or replace function public.notify_on_vendor_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' then
    perform public.notify_admins(
      'Nouveau vendeur à valider',
      'Boutique « ' || new.shop_name || ' » — ' || coalesce(new.city, '') || ' (' || coalesce(new.country, '') || ')',
      'account',
      '/admin/vendeurs',
      jsonb_build_object('vendor_id', new.id)
    );
    perform public.dispatch_platform_email(
      'vendor_pending_admin',
      '[Admin] Nouveau vendeur — ' || new.shop_name,
      'Nouveau vendeur à valider',
      'Boutique « ' || new.shop_name || ' » à ' || coalesce(new.city, '') ||
        ' (' || coalesce(new.country, '') || ').',
      '/admin/vendeurs',
      null,
      true,
      'admin',
      null,
      'Valider le vendeur'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists vendors_notify_insert on public.vendors;
create trigger vendors_notify_insert
  after insert on public.vendors
  for each row execute function public.notify_on_vendor_insert();

-- ─── 5) Livreur : statut + candidature admin ────────────────────────
create or replace function public.notify_on_driver_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body text;
  v_link text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'approved' then
    v_title := 'Compte livreur approuvé';
    v_body := 'Votre compte ' || new.driver_code || ' est actif. Connectez-vous pour recevoir des courses.';
    v_link := '/livreur';
  elsif new.status = 'rejected' then
    v_title := 'Candidature livreur refusée';
    v_body := coalesce(new.rejection_reason, 'Votre candidature livreur a été refusée.');
    v_link := '/auth/register/driver';
  elsif new.status = 'suspended' then
    v_title := 'Compte livreur suspendu';
    v_body := 'Votre compte livreur a été suspendu.';
    v_link := null;
  else
    return new;
  end if;

  perform public.notify_user(
    new.user_id, v_title, v_body, 'account', v_link,
    jsonb_build_object('driver_id', new.id)
  );

  perform public.dispatch_platform_email(
    'driver_status',
    'AfriZone — ' || v_title,
    v_title,
    v_body,
    v_link,
    array[new.user_id],
    false,
    'driver',
    null,
    case when v_link is null then null else 'Ouvrir mon espace' end
  );

  return new;
end;
$$;

create or replace function public.notify_on_driver_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' then
    perform public.notify_admins(
      'Nouveau livreur à valider',
      'Code ' || new.driver_code || ' — ' || coalesce(new.city, '') || ' (' || coalesce(new.country, '') || ')',
      'account',
      '/admin/livreurs',
      jsonb_build_object('driver_id', new.id)
    );
    perform public.dispatch_platform_email(
      'driver_pending_admin',
      '[Admin] Nouveau livreur — ' || new.driver_code,
      'Nouveau livreur à valider',
      'Livreur ' || new.driver_code || ' à ' || coalesce(new.city, '') ||
        ' (' || coalesce(new.country, '') || ').',
      '/admin/livreurs',
      null,
      true,
      'admin',
      null,
      'Valider le livreur'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists drivers_notify_insert on public.drivers;
create trigger drivers_notify_insert
  after insert on public.drivers
  for each row execute function public.notify_on_driver_insert();

-- Course assignée → e-mail livreur
create or replace function public.notify_on_delivery_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d_user uuid;
  v_title text := 'Nouvelle course';
  v_body text;
begin
  select user_id into d_user from public.drivers where id = new.driver_id;
  if d_user is null then
    return new;
  end if;

  v_body := coalesce(new.pickup_city, '') || ' → ' || coalesce(new.delivery_city, '');

  perform public.notify_user(
    d_user,
    v_title,
    v_body,
    'delivery',
    '/livreur/courses/' || new.id::text,
    jsonb_build_object('delivery_id', new.id)
  );

  perform public.dispatch_platform_email(
    'delivery_assigned',
    'AfriZone — Nouvelle course',
    v_title,
    'AfriZone vous a assigné une course : ' || v_body || '.',
    '/livreur/courses/' || new.id::text,
    array[d_user],
    false,
    'driver',
    new.order_id,
    'Voir la course'
  );

  return new;
end;
$$;

-- ─── 6) Lot de courses → e-mail livreur ─────────────────────────────
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
  v_driver_user uuid;
  v_body text;
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

  select user_id into v_driver_user from public.drivers where id = p_driver_id;
  v_body := 'AfriZone vous propose ' || array_length(p_order_ids, 1)::text ||
    ' livraison(s) pour ' || p_offered_fee::text || ' FCFA. Accepter sous 2 h.';

  if v_driver_user is not null then
    perform public.notify_user(
      v_driver_user,
      'Nouvelle course groupée',
      v_body,
      'delivery',
      '/courses',
      jsonb_build_object('batch_id', v_batch_id, 'fee', p_offered_fee)
    );
    perform public.dispatch_platform_email(
      'batch_offered',
      'AfriZone — Course groupée (' || p_offered_fee::text || ' FCFA)',
      'Nouvelle course groupée',
      v_body,
      '/courses',
      array[v_driver_user],
      false,
      'driver',
      null,
      'Voir le lot'
    );
  end if;

  return v_batch_id;
end;
$$;

grant execute on function public.admin_create_delivery_batch(uuid, uuid[], integer, text) to authenticated;

-- ─── 7) Produits : soumission (admin) + revue (vendeur) ─────────────
create or replace function public.notify_product_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if new.approval_status <> 'pending' then
    return new;
  end if;

  select user_id into v_user_id from public.vendors where id = new.vendor_id;
  if v_user_id is not null then
    perform public.notify_user(
      v_user_id,
      'Produit en attente de validation',
      '« ' || new.name || ' » a été envoyé à l''équipe AfriZone. Il sera visible sur '
        || 'l''accueil et le catalogue après approbation.',
      'product',
      '/vendeur/produits',
      jsonb_build_object('product_id', new.id, 'approval_status', new.approval_status)
    );
  end if;

  perform public.notify_admins(
    'Produit à valider',
    '« ' || new.name || ' » est en attente de validation.',
    'product',
    '/admin/produits-a-valider',
    jsonb_build_object('product_id', new.id)
  );
  perform public.dispatch_platform_email(
    'product_pending_admin',
    '[Admin] Produit à valider — ' || new.name,
    'Produit à valider',
    'Le produit « ' || new.name || ' » attend votre validation.',
    '/admin/produits-a-valider',
    null,
    true,
    'admin',
    null,
    'Valider le produit'
  );

  return new;
end;
$$;

create or replace function public.admin_review_product(
  p_product_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_user_id uuid;
  v_status text;
  v_title text;
  v_body text;
begin
  if not public.is_admin() then
    raise exception 'Admin requis';
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Produit introuvable';
  end if;

  if not p_approve and coalesce(trim(p_reason), '') = '' then
    raise exception 'Motif de refus obligatoire';
  end if;

  v_status := case when p_approve then 'approved' else 'rejected' end;

  update public.products
  set
    approval_status = v_status,
    approved_at = case when p_approve then now() else null end,
    approved_by = case when p_approve then auth.uid() else null end,
    rejection_reason = case when p_approve then null else trim(p_reason) end,
    updated_at = now()
  where id = p_product_id;

  select user_id into v_user_id from public.vendors where id = v_product.vendor_id;

  if v_user_id is not null then
    v_title := case when p_approve then 'Produit approuvé' else 'Produit refusé' end;
    v_body := case
      when p_approve then '« ' || v_product.name
        || ' » est en ligne sur l''accueil et le catalogue AfriZone.'
      else '« ' || v_product.name || ' » a été refusé : ' || trim(p_reason)
    end;

    perform public.notify_user(
      v_user_id, v_title, v_body, 'product', '/vendeur/produits',
      jsonb_build_object('product_id', p_product_id, 'approval_status', v_status)
    );

    perform public.dispatch_platform_email(
      'product_review',
      'AfriZone — ' || v_title,
      v_title,
      v_body,
      '/vendeur/produits',
      array[v_user_id],
      false,
      'vendor',
      null,
      'Voir mes produits'
    );
  end if;

  return jsonb_build_object('ok', true, 'product_id', p_product_id, 'approval_status', v_status);
end;
$$;

grant execute on function public.admin_review_product(uuid, boolean, text) to authenticated;

-- Re-soumission (édition vendeur → pending) : même alerte admin
drop trigger if exists notify_product_resubmitted on public.products;
create trigger notify_product_resubmitted
  after update of approval_status on public.products
  for each row
  when (new.approval_status = 'pending' and old.approval_status is distinct from 'pending')
  execute function public.notify_product_submitted();

-- ─── 8) Retraits livreur → admin + livreur ──────────────────────────
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
  v_body text;
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

  v_body := p_amount::text || ' FCFA — ' || coalesce(v_account.provider, '') || ' ' ||
    coalesce(v_account.phone, '');

  perform public.notify_admins(
    'Demande de retrait livreur',
    v_body,
    'payment',
    '/admin/retraits',
    jsonb_build_object('withdrawal_id', v_req_id, 'driver_id', v_driver_id, 'amount', p_amount)
  );

  perform public.dispatch_platform_email(
    'withdrawal_request_admin',
    '[Admin] Retrait livreur — ' || p_amount::text || ' FCFA',
    'Demande de retrait livreur',
    v_body,
    '/admin/retraits',
    null,
    true,
    'admin',
    null,
    'Traiter le retrait'
  );

  return jsonb_build_object(
    'ok', true,
    'withdrawal_id', v_req_id,
    'amount', p_amount,
    'balance', v_new_balance
  );
end;
$$;

grant execute on function public.request_driver_withdrawal(integer) to authenticated;

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
  v_driver_user uuid;
  v_title text;
  v_body text;
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

  select user_id into v_driver_user from public.drivers where id = v_req.driver_id;

  if p_action = 'approve' then
    update public.driver_withdrawal_requests
    set status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        admin_note = p_admin_note
    where id = p_withdrawal_id;

    if v_driver_user is not null then
      v_title := 'Retrait approuvé';
      v_body := 'Votre demande de ' || v_req.amount::text ||
        ' FCFA a été approuvée. Le virement sera effectué prochainement.';
      perform public.notify_user(
        v_driver_user, v_title, v_body, 'payment', '/portefeuille',
        jsonb_build_object('withdrawal_id', v_req.id)
      );
      perform public.dispatch_platform_email(
        'withdrawal_approved',
        'AfriZone — Retrait approuvé',
        v_title,
        v_body,
        '/portefeuille',
        array[v_driver_user],
        false,
        'driver',
        null,
        'Voir mon portefeuille'
      );
    end if;

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

    if v_driver_user is not null then
      v_title := 'Retrait effectué';
      v_body := v_req.amount::text ||
        ' FCFA ont été envoyés sur votre Mobile Money / Wave.';
      perform public.notify_user(
        v_driver_user, v_title, v_body, 'payment', '/portefeuille',
        jsonb_build_object('withdrawal_id', v_req.id, 'amount', v_req.amount)
      );
      perform public.dispatch_platform_email(
        'withdrawal_paid',
        'AfriZone — Retrait effectué',
        v_title,
        v_body,
        '/portefeuille',
        array[v_driver_user],
        false,
        'driver',
        null,
        'Voir mon portefeuille'
      );
    end if;

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

    if v_driver_user is not null then
      v_title := 'Retrait refusé';
      v_body := coalesce(
        p_admin_note,
        'Votre demande de retrait a été refusée. Les fonds sont de nouveau disponibles.'
      );
      perform public.notify_user(
        v_driver_user, v_title, v_body, 'payment', '/portefeuille',
        jsonb_build_object('withdrawal_id', v_req.id)
      );
      perform public.dispatch_platform_email(
        'withdrawal_rejected',
        'AfriZone — Retrait refusé',
        v_title,
        v_body,
        '/portefeuille',
        array[v_driver_user],
        false,
        'driver',
        null,
        'Voir mon portefeuille'
      );
    end if;

    return jsonb_build_object('ok', true, 'status', 'rejected');
  end if;

  raise exception 'Action invalide (approve|paid|reject)';
end;
$$;

grant execute on function public.admin_review_withdrawal(uuid, text, text, text) to authenticated;

-- ─── 9) Abonnement activé → e-mail client/vendeur ───────────────────
create or replace function public.activate_subscription(p_subscription_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_days int;
  v_plan_name text;
  v_audience text;
  v_role text;
begin
  select s.*, p.duration_days, p.price_xof, p.name as plan_name, p.audience
  into v_sub
  from public.subscriptions s
  join public.subscription_plans p on p.id = s.plan_id
  where s.id = p_subscription_id
  for update of s;

  if not found then
    raise exception 'Abonnement introuvable';
  end if;

  v_days := coalesce(v_sub.duration_days, 30) * greatest(1, coalesce(v_sub.term_months, 1));
  v_plan_name := v_sub.plan_name;
  v_audience := v_sub.audience;
  v_role := case when v_audience = 'vendor' then 'vendor' else 'customer' end;

  update public.subscriptions s
  set status = 'expired', updated_at = now()
  from public.subscription_plans p
  where s.user_id = v_sub.user_id
    and s.id <> p_subscription_id
    and s.status = 'active'
    and p.id = s.plan_id
    and p.audience = v_audience;

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

  perform public.notify_user(
    v_sub.user_id,
    'Abonnement activé',
    'Votre plan « ' || v_plan_name || ' » est actif pour ' ||
      greatest(1, coalesce(v_sub.term_months, 1))::text || ' mois.',
    'payment',
    case when v_audience = 'vendor' then '/vendeur/abonnement' else '/compte/abonnement' end,
    jsonb_build_object('subscription_id', p_subscription_id, 'plan', v_plan_name)
  );

  perform public.dispatch_platform_email(
    'subscription_activated',
    'AfriZone — Abonnement « ' || v_plan_name || ' » activé',
    'Abonnement activé',
    'Votre plan « ' || v_plan_name || ' » est maintenant actif pour ' ||
      greatest(1, coalesce(v_sub.term_months, 1))::text || ' mois (' ||
      v_days::text || ' jours). Merci de votre confiance.',
    case when v_audience = 'vendor' then '/vendeur/abonnement' else '/compte/abonnement' end,
    array[v_sub.user_id],
    false,
    v_role,
    null,
    'Voir mon abonnement'
  );

  return jsonb_build_object(
    'ok', true,
    'subscription_id', p_subscription_id,
    'term_months', greatest(1, coalesce(v_sub.term_months, 1)),
    'days', v_days
  );
end;
$$;

grant execute on function public.activate_subscription(uuid) to service_role;

-- =============================================================================
-- CONFIG (à exécuter une fois sur Supabase) :
--
-- insert into public.app_settings (key, value) values
--   ('supabase_url', 'https://VOTRE_REF.supabase.co'),
--   ('email_hook_secret', 'un-secret-long-aleatoire')
-- on conflict (key) do update set value = excluded.value, updated_at = now();
--
-- supabase functions deploy order-emails --no-verify-jwt
-- supabase secrets set RESEND_API_KEY=re_xxx EMAIL_HOOK_SECRET=un-secret-long APP_URL=https://votre-domaine
-- supabase secrets set EMAIL_FROM="AfriZone <noreply@votredomaine.com>"
-- =============================================================================
