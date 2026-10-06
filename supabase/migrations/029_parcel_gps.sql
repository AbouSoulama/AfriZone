-- AfriZone 029 — GPS enlèvement / livraison pour les envois de colis

alter table public.parcel_shipments
  add column if not exists pickup_lat double precision,
  add column if not exists pickup_lng double precision,
  add column if not exists delivery_lat double precision,
  add column if not exists delivery_lng double precision;

comment on column public.parcel_shipments.pickup_lat is
  'Latitude GPS du point d''enlèvement (optionnel)';
comment on column public.parcel_shipments.pickup_lng is
  'Longitude GPS du point d''enlèvement (optionnel)';
comment on column public.parcel_shipments.delivery_lat is
  'Latitude GPS du point de livraison (optionnel)';
comment on column public.parcel_shipments.delivery_lng is
  'Longitude GPS du point de livraison (optionnel)';
