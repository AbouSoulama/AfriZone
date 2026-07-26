import { supabase } from '../lib/supabase';
import type { CatalogProduct, CatalogVendor } from '../types/catalog';

export interface AdminShopRow extends CatalogVendor {
  userId: string;
  address: string | null;
  createdAt: string;
  productsCount?: number;
}

export interface AdminProductRow extends CatalogProduct {
  vendorId: string;
  vendorName?: string | null;
}

function mapShop(row: Record<string, unknown>): AdminShopRow {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    shopName: row.shop_name as string,
    shopSlug: row.shop_slug as string,
    shopDescription: (row.shop_description as string) ?? null,
    shopCategory: (row.shop_category as string) ?? null,
    shopLogoUrl: (row.shop_logo_url as string) ?? null,
    vendorCode: row.vendor_code as string,
    country: row.country as string,
    city: row.city as string,
    rating: Number(row.rating ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    totalSales: Number(row.total_sales ?? 0),
    status: row.status as string,
    address: (row.address as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapProduct(row: Record<string, unknown>): AdminProductRow {
  const vendor = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;
  const v = vendor as Record<string, unknown> | null | undefined;
  return {
    id: row.id as string,
    vendorId: row.vendor_id as string,
    vendorName: v ? ((v.shop_name as string) ?? null) : null,
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
  };
}

export async function fetchShopsForAdmin(): Promise<AdminShopRow[]> {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const shops = (data ?? []).map((r) => mapShop(r as Record<string, unknown>));
  const ids = shops.map((s) => s.id);
  if (!ids.length) return shops;

  const { data: products } = await supabase
    .from('products')
    .select('vendor_id')
    .in('vendor_id', ids);

  const counts: Record<string, number> = {};
  for (const p of products ?? []) {
    const vid = p.vendor_id as string;
    counts[vid] = (counts[vid] || 0) + 1;
  }

  return shops.map((s) => ({ ...s, productsCount: counts[s.id] || 0 }));
}

export async function fetchProductsForAdmin(vendorId?: string): Promise<AdminProductRow[]> {
  let query = supabase
    .from('products')
    .select('*, vendors(shop_name)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (vendorId) query = query.eq('vendor_id', vendorId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapProduct(r as Record<string, unknown>));
}

export async function updateShopAdmin(
  shopId: string,
  patch: Partial<{
    shopName: string;
    shopDescription: string | null;
    shopCategory: string | null;
    city: string;
    status: string;
  }>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.shopName !== undefined) payload.shop_name = patch.shopName;
  if (patch.shopDescription !== undefined) payload.shop_description = patch.shopDescription;
  if (patch.shopCategory !== undefined) payload.shop_category = patch.shopCategory;
  if (patch.city !== undefined) payload.city = patch.city;
  if (patch.status !== undefined) payload.status = patch.status;
  const { error } = await supabase.from('vendors').update(payload).eq('id', shopId);
  if (error) throw new Error(error.message);
}

export async function deleteShopAdmin(shopId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_vendor', {
    p_vendor_id: shopId,
  });
  if (error) {
    throw new Error(
      error.message.includes('function') || error.message.includes('schema cache')
        ? 'Suppression boutique indisponible : exécutez la migration 015_fix_admin_deletes.sql'
        : error.message
    );
  }
}

export async function updateProductAdmin(
  productId: string,
  patch: Partial<{
    name: string;
    description: string | null;
    price: number;
    stock: number;
    category: string;
    isActive: boolean;
    isFeatured: boolean;
  }>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.price !== undefined) payload.price = patch.price;
  if (patch.stock !== undefined) payload.stock = patch.stock;
  if (patch.category !== undefined) payload.category = patch.category;
  if (patch.isActive !== undefined) payload.is_active = patch.isActive;
  if (patch.isFeatured !== undefined) payload.is_featured = patch.isFeatured;
  const { error } = await supabase.from('products').update(payload).eq('id', productId);
  if (error) throw new Error(error.message);
}

export async function deleteProductAdmin(productId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_product', {
    p_product_id: productId,
  });
  if (error) {
    throw new Error(
      error.message.includes('function') || error.message.includes('schema cache')
        ? 'Suppression produit indisponible : exécutez la migration 015_fix_admin_deletes.sql'
        : error.message
    );
  }
}
