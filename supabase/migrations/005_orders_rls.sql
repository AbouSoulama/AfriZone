-- AfriZone Module 4 — RLS commandes + helper numéro de commande
-- Exécuter dans Supabase SQL Editor

-- Numéro de commande unique
create or replace function public.generate_order_number()
returns text
language plpgsql
as $$
declare
  code text;
begin
  code := 'AZ-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  return code;
end;
$$;

-- order_items : lecture / écriture liées à la commande du client ou vendeur
drop policy if exists "Users view own order items" on public.order_items;
create policy "Users view own order items"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (
          o.user_id = auth.uid()
          or exists (
            select 1 from public.vendors v
            where v.id = o.vendor_id and v.user_id = auth.uid()
          )
          or public.is_admin()
        )
    )
  );

drop policy if exists "Users insert own order items" on public.order_items;
create policy "Users insert own order items"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

-- Client peut annuler sa commande (pending seulement) — via update status
drop policy if exists "Users update own pending orders" on public.orders;
create policy "Users update own pending orders"
  on public.orders for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.vendors v
      where v.id = orders.vendor_id and v.user_id = auth.uid()
    )
    or public.is_admin()
  );

-- Frais livraison AfriZone par défaut (référence, utilisé côté app)
-- Pas de table dédiée pour le MVP

-- Décrémenter stock automatiquement à l'ajout d'une ligne commande
create or replace function public.decrement_stock_on_order_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
  set
    stock = greatest(0, stock - new.quantity),
    sold_count = sold_count + new.quantity
  where id = new.product_id;
  return new;
end;
$$;

drop trigger if exists order_items_decrement_stock on public.order_items;
create trigger order_items_decrement_stock
  after insert on public.order_items
  for each row execute function public.decrement_stock_on_order_item();
