-- AfriZone — Schéma initial Supabase
-- Exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
-- Ce script crée les tables de base + RLS pour le MVP.

-- Extensions utiles
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────
create type public.user_role as enum ('client', 'vendeur', 'admin', 'livreur');
create type public.vendor_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.order_status as enum ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
create type public.delivery_mode as enum ('vendor', 'afrizone');

-- ─────────────────────────────────────────────
-- PROFILES (lié à auth.users)
-- ─────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text unique,
  email text,
  role public.user_role not null default 'client',
  city text,
  avatar_url text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);
create index profiles_phone_idx on public.profiles(phone);

-- Auto-créer un profil à chaque inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, email, role, city)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Utilisateur'),
    new.phone,
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'client'),
    new.raw_user_meta_data->>'city'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────
-- VENDORS
-- ─────────────────────────────────────────────
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  status public.vendor_status not null default 'pending',
  vendor_code text not null unique,
  shop_name text not null,
  shop_slug text not null unique,
  shop_description text,
  shop_category text,
  shop_logo_url text,
  country text not null,
  city text not null,
  address text,
  commerce_register text,
  id_document_url text,
  id_document_type text,
  rating numeric(3,2) not null default 0,
  total_sales int not null default 0,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vendors_status_idx on public.vendors(status);
create index vendors_vendor_code_idx on public.vendors(vendor_code);

-- ─────────────────────────────────────────────
-- PRODUCTS
-- ─────────────────────────────────────────────
create table public.products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  category text not null,
  subcategory text,
  price numeric(12,2) not null,
  old_price numeric(12,2),
  currency text not null default 'FCFA',
  stock int not null default 0,
  condition text not null default 'neuf',
  weight_kg numeric(8,2),
  delivery_mode public.delivery_mode not null,
  delivery_zones text[],
  vendor_delivery_fee numeric(12,2),
  images text[] not null default '{}',
  main_image text,
  rating numeric(3,2) not null default 0,
  review_count int not null default 0,
  sold_count int not null default 0,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_vendor_id_idx on public.products(vendor_id);
create index products_category_idx on public.products(category);
create index products_is_active_idx on public.products(is_active);

-- ─────────────────────────────────────────────
-- ADDRESSES
-- ─────────────────────────────────────────────
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text,
  full_name text not null,
  phone text not null,
  country text not null,
  city text not null,
  address text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- CARTS & CART ITEMS
-- ─────────────────────────────────────────────
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity int not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id)
);

-- ─────────────────────────────────────────────
-- ORDERS
-- ─────────────────────────────────────────────
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references public.profiles(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  status public.order_status not null default 'pending',
  subtotal numeric(12,2) not null,
  shipping_cost numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  payment_method text,
  payment_status text not null default 'pending',
  shipping_address text not null,
  shipping_city text not null,
  shipping_phone text not null,
  tracking_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity int not null,
  price numeric(12,2) not null,
  total numeric(12,2) not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- PARCEL SHIPMENTS (Service envoi de colis)
-- ─────────────────────────────────────────────
create type public.parcel_status as enum (
  'received', 'pickup_scheduled', 'collected', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'
);

create table public.parcel_shipments (
  id uuid primary key default gen_random_uuid(),
  tracking_number text not null unique,
  user_id uuid references public.profiles(id) on delete set null,
  sender_name text not null,
  sender_phone text not null,
  pickup_address text not null,
  pickup_city text not null,
  recipient_name text not null,
  recipient_phone text not null,
  delivery_address text not null,
  delivery_city text not null,
  parcel_type text not null,
  weight_kg numeric(8,2) not null,
  content_description text not null,
  special_instructions text,
  price numeric(12,2) not null,
  status public.parcel_status not null default 'received',
  payment_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- HELPER : updated_at automatique
-- ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger vendors_updated_at before update on public.vendors for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.vendors enable row level security;
alter table public.products enable row level security;
alter table public.addresses enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.parcel_shipments enable row level security;

-- Profiles : lecture publique limitée, édition par le propriétaire
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Vendors : lecture publique des vendeurs approuvés
create policy "Approved vendors are public"
  on public.vendors for select using (status = 'approved' or auth.uid() = user_id);

create policy "Users can insert own vendor application"
  on public.vendors for insert with check (auth.uid() = user_id);

create policy "Vendors can update own shop"
  on public.vendors for update using (auth.uid() = user_id);

-- Products : lecture publique des produits actifs
create policy "Active products are public"
  on public.products for select using (
    is_active = true
    or exists (
      select 1 from public.vendors v
      where v.id = products.vendor_id and v.user_id = auth.uid()
    )
  );

create policy "Vendors can manage own products"
  on public.products for all using (
    exists (
      select 1 from public.vendors v
      where v.id = products.vendor_id and v.user_id = auth.uid()
    )
  );

-- Addresses : propriétaire uniquement
create policy "Users manage own addresses"
  on public.addresses for all using (auth.uid() = user_id);

-- Carts : propriétaire uniquement
create policy "Users manage own cart"
  on public.carts for all using (auth.uid() = user_id);

create policy "Users manage own cart items"
  on public.cart_items for all using (
    exists (select 1 from public.carts c where c.id = cart_items.cart_id and c.user_id = auth.uid())
  );

-- Orders : client et vendeur concernés
create policy "Users view own orders"
  on public.orders for select using (
    auth.uid() = user_id
    or exists (select 1 from public.vendors v where v.id = orders.vendor_id and v.user_id = auth.uid())
  );

create policy "Users create own orders"
  on public.orders for insert with check (auth.uid() = user_id);

-- Parcel shipments : propriétaire
create policy "Users manage own parcels"
  on public.parcel_shipments for all using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- STORAGE BUCKETS (à créer aussi dans Dashboard → Storage)
-- vendor-documents (privé) | product-images (public) | avatars (public)
-- ─────────────────────────────────────────────
