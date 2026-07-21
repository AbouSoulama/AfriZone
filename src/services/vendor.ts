import { supabase } from '../lib/supabase';
import { slugify } from '../lib/auth-helpers';
import type { CatalogProduct, DeliveryMode, ProductCondition } from '../types/catalog';

export interface VendorStats {
  productsActive: number;
  productsTotal: number;
  lowStock: number;
  totalSold: number;
}

export interface ProductInput {
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  price: number;
  oldPrice?: number | null;
  stock: number;
  condition: ProductCondition;
  weightKg?: number | null;
  deliveryMode: DeliveryMode;
  deliveryZones?: string[];
  vendorDeliveryFee?: number | null;
  tags?: string[];
  isActive?: boolean;
  images?: string[];
  mainImage?: string | null;
}

function mapProduct(row: Record<string, unknown>): CatalogProduct {
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
    deliveryMode: row.delivery_mode as DeliveryMode,
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

export async function getVendorIdForUser(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('vendors')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export async function fetchVendorStats(vendorId: string): Promise<VendorStats> {
  const { data, error } = await supabase
    .from('products')
    .select('id, stock, is_active, sold_count')
    .eq('vendor_id', vendorId);

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  return {
    productsTotal: rows.length,
    productsActive: rows.filter((r) => r.is_active).length,
    lowStock: rows.filter((r) => r.is_active && Number(r.stock) <= 5).length,
    totalSold: rows.reduce((sum, r) => sum + Number(r.sold_count ?? 0), 0),
  };
}

export async function fetchMyProducts(vendorId: string): Promise<CatalogProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapProduct(row));
}

export async function fetchMyProduct(
  vendorId: string,
  productId: string
): Promise<CatalogProduct | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('id', productId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapProduct(data) : null;
}

export async function createProduct(
  vendorId: string,
  input: ProductInput
): Promise<CatalogProduct> {
  if (!input.deliveryMode) {
    throw new Error('Le mode de livraison est obligatoire.');
  }
  if (input.deliveryMode === 'vendor') {
    if (!input.deliveryZones?.length) {
      throw new Error('Indiquez au moins une zone de livraison.');
    }
    if (input.vendorDeliveryFee == null) {
      throw new Error('Indiquez les frais de livraison vendeur.');
    }
  }

  const base = slugify(input.name) || 'produit';
  const slug = `${base}-${Date.now().toString(36)}`;
  const images = input.images ?? [];

  const { data, error } = await supabase
    .from('products')
    .insert({
      vendor_id: vendorId,
      name: input.name,
      slug,
      description: input.description,
      category: input.category,
      subcategory: input.subcategory || null,
      price: input.price,
      old_price: input.oldPrice ?? null,
      stock: input.stock,
      condition: input.condition,
      weight_kg: input.weightKg ?? null,
      delivery_mode: input.deliveryMode,
      delivery_zones: input.deliveryMode === 'vendor' ? input.deliveryZones : null,
      vendor_delivery_fee:
        input.deliveryMode === 'vendor' ? input.vendorDeliveryFee : null,
      images,
      main_image: input.mainImage || images[0] || null,
      tags: input.tags ?? [],
      is_active: input.isActive ?? true,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapProduct(data);
}

export async function updateProduct(
  vendorId: string,
  productId: string,
  input: ProductInput
): Promise<CatalogProduct> {
  if (input.deliveryMode === 'vendor') {
    if (!input.deliveryZones?.length) {
      throw new Error('Indiquez au moins une zone de livraison.');
    }
    if (input.vendorDeliveryFee == null) {
      throw new Error('Indiquez les frais de livraison vendeur.');
    }
  }

  const images = input.images ?? [];

  const { data, error } = await supabase
    .from('products')
    .update({
      name: input.name,
      description: input.description,
      category: input.category,
      subcategory: input.subcategory || null,
      price: input.price,
      old_price: input.oldPrice ?? null,
      stock: input.stock,
      condition: input.condition,
      weight_kg: input.weightKg ?? null,
      delivery_mode: input.deliveryMode,
      delivery_zones: input.deliveryMode === 'vendor' ? input.deliveryZones : null,
      vendor_delivery_fee:
        input.deliveryMode === 'vendor' ? input.vendorDeliveryFee : null,
      images,
      main_image: input.mainImage || images[0] || null,
      tags: input.tags ?? [],
      is_active: input.isActive ?? true,
    })
    .eq('id', productId)
    .eq('vendor_id', vendorId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapProduct(data);
}

export async function setProductActive(
  vendorId: string,
  productId: string,
  isActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ is_active: isActive })
    .eq('id', productId)
    .eq('vendor_id', vendorId);
  if (error) throw new Error(error.message);
}

export async function deleteProduct(vendorId: string, productId: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('vendor_id', vendorId);
  if (error) throw new Error(error.message);
}

export async function updateStock(
  vendorId: string,
  productId: string,
  stock: number
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ stock })
    .eq('id', productId)
    .eq('vendor_id', vendorId);
  if (error) throw new Error(error.message);
}

export async function uploadProductImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('product-images').upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}
