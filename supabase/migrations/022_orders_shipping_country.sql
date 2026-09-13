-- Pays de livraison sur les commandes (multi-pays AfriZone)

alter table public.orders
  add column if not exists shipping_country text;

-- Backfill depuis la ville de livraison ou le pays du vendeur
update public.orders o
set shipping_country = coalesce(
  (
    select case
      when lower(o.shipping_city) in ('dakar', 'thiès', 'thies', 'saint-louis', 'kaolack') then 'SN'
      when lower(o.shipping_city) in ('ouagadougou', 'bobo-dioulasso', 'bobo', 'koudougou') then 'BF'
      when lower(o.shipping_city) in ('bamako', 'sikasso', 'ségou', 'segou', 'kayes') then 'ML'
      else null
    end
  ),
  (select v.country from public.vendors v where v.id = o.vendor_id),
  'SN'
)
where shipping_country is null;

alter table public.orders
  alter column shipping_country set default 'SN';

create index if not exists idx_orders_shipping_country on public.orders (shipping_country);
