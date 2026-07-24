import { supabase } from '../lib/supabase';
import type {
  CatalogFilters,
  CatalogProduct,
  CatalogResult,
  CatalogVendor,
} from '../types/catalog';

type ProductRow = Record<string, unknown> & {
  vendors?: Record<string, unknown> | Record<string, unknown>[] | null;
};

function mapVendor(row: Record<string, unknown> | null | undefined): CatalogVendor | null {
  if (!row) return null;
  return {
    id: row.id as string,
    shopName: row.shop_name as string,
    shopSlug: row.shop_slug as string,
    shopDescription: (row.shop_description as string) ?? null,
    shopCategory: (row.shop_category as string) ?? null,
    shopLogoUrl: (row.shop_logo_url as string) ?? null,
    vendorCode: row.vendor_code as string,
    country: row.country as string,
    city: row.city as string,
    rating: Number(row.rating ?? 0),
    totalSales: Number(row.total_sales ?? 0),
    status: row.status as string,
  };
}

function mapProduct(row: ProductRow): CatalogProduct {
  const vendorRaw = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    description: (row.description as string) ?? null,
    category: row.category as string,
    subcategory: (row.subcategory as string) ?? null,
    price: Number(row.price),
    oldPrice: row.old_price != null ? Number(row.old_price) : null,
    currency: (row.currency as string) || 'FCFA',
    stock: Number(row.stock ?? 0),
    condition: (row.condition as string) || 'neuf',
    weightKg: row.weight_kg != null ? Number(row.weight_kg) : null,
    deliveryMode: row.delivery_mode as CatalogProduct['deliveryMode'],
    deliveryZones: (row.delivery_zones as string[]) ?? null,
    vendorDeliveryFee:
      row.vendor_delivery_fee != null ? Number(row.vendor_delivery_fee) : null,
    images: (row.images as string[]) ?? [],
    mainImage: (row.main_image as string) ?? null,
    rating: Number(row.rating ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    soldCount: Number(row.sold_count ?? 0),
    isActive: Boolean(row.is_active),
    isFeatured: Boolean(row.is_featured),
    tags: (row.tags as string[]) ?? [],
    createdAt: row.created_at as string,
    vendor: mapVendor(vendorRaw as Record<string, unknown> | null),
  };
}

const PRODUCT_SELECT = `
  *,
  vendors!inner (
    id, shop_name, shop_slug, shop_description, shop_category, shop_logo_url,
    vendor_code, country, city, rating, total_sales, status
  )
`;

const PRODUCT_SELECT_OPTIONAL = `
  *,
  vendors (
    id, shop_name, shop_slug, shop_description, shop_category, shop_logo_url,
    vendor_code, country, city, rating, total_sales, status
  )
`;

export function formatPrice(price: number, currency = 'FCFA'): string {
  return `${new Intl.NumberFormat('fr-FR').format(price)} ${currency}`;
}

export async function fetchProducts(filters: CatalogFilters = {}): Promise<CatalogResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? 12;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('products')
    .select(PRODUCT_SELECT, { count: 'exact' })
    .eq('is_active', true)
    .eq('vendors.status', 'approved');

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%,tags.cs.{${q}}`);
  }

  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  if (filters.condition) {
    query = query.eq('condition', filters.condition);
  }

  if (filters.minPrice != null && !Number.isNaN(filters.minPrice)) {
    query = query.gte('price', filters.minPrice);
  }

  if (filters.maxPrice != null && !Number.isNaN(filters.maxPrice)) {
    query = query.lte('price', filters.maxPrice);
  }

  if (filters.city) {
    query = query.eq('vendors.city', filters.city);
  }

  switch (filters.sort) {
    case 'price_asc':
      query = query.order('price', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('price', { ascending: false });
      break;
    case 'popular':
      query = query.order('sold_count', { ascending: false });
      break;
    case 'recent':
      query = query.order('created_at', { ascending: false });
      break;
    default:
      query = query.order('is_featured', { ascending: false }).order('sold_count', {
        ascending: false,
      });
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error('fetchProducts', error);
    throw new Error(error.message);
  }

  let products = (data ?? []).map((row) => mapProduct(row as ProductRow));

  // Filtre ville / verified côté client si jointure partielle
  if (filters.city) {
    products = products.filter((p) => p.vendor?.city === filters.city);
  }
  if (filters.verifiedOnly) {
    products = products.filter((p) => p.vendor?.status === 'approved');
  }

  return {
    products,
    total: count ?? products.length,
    page,
    pageSize,
  };
}

export async function fetchProductBySlug(slug: string): Promise<CatalogProduct | null> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT_OPTIONAL)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('fetchProductBySlug', error);
    throw new Error(error.message);
  }
  if (!data) return null;
  return mapProduct(data as ProductRow);
}

export async function fetchFeaturedProducts(
  limit = 8,
  city?: string
): Promise<CatalogProduct[]> {
  let query = supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('is_active', true)
    .eq('vendors.status', 'approved');

  if (city) {
    query = query.eq('vendors.city', city);
  }

  const { data, error } = await query
    .order('is_featured', { ascending: false })
    .order('sold_count', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('fetchFeaturedProducts', error);
    return [];
  }
  return (data ?? []).map((row) => mapProduct(row as ProductRow));
}

export async function fetchFeaturedVendors(
  limit = 8,
  city?: string
): Promise<CatalogVendor[]> {
  let query = supabase.from('vendors').select('*').eq('status', 'approved');

  if (city) {
    query = query.eq('city', city);
  }

  const { data, error } = await query
    .order('rating', { ascending: false })
    .order('total_sales', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('fetchFeaturedVendors', error);
    return [];
  }
  return (data ?? []).map((row) => mapVendor(row)!);
}

export async function fetchVendorBySlug(slug: string): Promise<CatalogVendor | null> {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('shop_slug', slug)
    .eq('status', 'approved')
    .maybeSingle();

  if (error) {
    console.error('fetchVendorBySlug', error);
    throw new Error(error.message);
  }
  return mapVendor(data);
}

export async function fetchVendorProducts(vendorId: string): Promise<CatalogProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT_OPTIONAL)
    .eq('vendor_id', vendorId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchVendorProducts', error);
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapProduct(row as ProductRow));
}

export async function countProductsByCategory(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('products')
    .select('category')
    .eq('is_active', true);

  if (error || !data) return {};
  return data.reduce<Record<string, number>>((acc, row) => {
    const cat = row.category as string;
    acc[cat] = (acc[cat] ?? 0) + 1;
    return acc;
  }, {});
}
