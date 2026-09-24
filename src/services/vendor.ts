import { supabase } from '../lib/supabase';
import { slugify } from '../lib/auth-helpers';
import type { CatalogProduct, DeliveryMode, ProductCondition } from '../types/catalog';
import {
  mapProductRow,
  receptionPayload,
  type ReceptionInput,
} from './product-mapper';

export interface VendorStats {
  productsActive: number;
  productsTotal: number;
  lowStock: number;
  totalSold: number;
  pendingApproval: number;
  rejected: number;
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
  /** Étape 1 : photos génériques / catalogue */
  images?: string[];
  mainImage?: string | null;
  /** Étape 2 : photos réelles du produit */
  realImages?: string[];
  /** Étape 2 : réception du produit dans l'entrepôt AfriZone */
  reception?: ReceptionInput;
}

const mapProduct = mapProductRow;

/** Validations communes création / mise à jour. */
function assertProductInput(input: ProductInput): void {
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
  if (!input.images?.length) {
    throw new Error('Étape 1 : ajoutez au moins 1 photo générique du produit.');
  }
  if (!input.realImages?.length) {
    throw new Error('Étape 2 : ajoutez au moins 1 photo réelle du produit.');
  }
  if (!input.reception?.handoverMethod) {
    throw new Error('Étape 2 : indiquez comment AfriZone réceptionne le produit.');
  }
  if (
    input.reception.handoverMethod !== 'vendor_stock' &&
    !input.reception.warehouseCity
  ) {
    throw new Error('Étape 2 : choisissez le hub AfriZone de réception.');
  }
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
    .select('id, stock, is_active, sold_count, approval_status')
    .eq('vendor_id', vendorId);

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const approved = rows.filter((r) => r.approval_status === 'approved');
  return {
    productsTotal: rows.length,
    productsActive: approved.filter((r) => r.is_active).length,
    lowStock: approved.filter((r) => r.is_active && Number(r.stock) <= 5).length,
    totalSold: rows.reduce((sum, r) => sum + Number(r.sold_count ?? 0), 0),
    pendingApproval: rows.filter((r) => r.approval_status === 'pending').length,
    rejected: rows.filter((r) => r.approval_status === 'rejected').length,
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

/** Colonnes communes création / mise à jour d'un produit vendeur. */
function productPayload(input: ProductInput): Record<string, unknown> {
  const images = input.images ?? [];
  return {
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
    real_images: input.realImages ?? [],
    tags: input.tags ?? [],
    is_active: input.isActive ?? true,
    ...receptionPayload(input.reception),
  };
}

export async function createProduct(
  vendorId: string,
  input: ProductInput
): Promise<CatalogProduct> {
  assertProductInput(input);

  const base = slugify(input.name) || 'produit';
  const slug = `${base}-${Date.now().toString(36)}`;

  const { data, error } = await supabase
    .from('products')
    .insert({
      vendor_id: vendorId,
      slug,
      ...productPayload(input),
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
  assertProductInput(input);

  const { data, error } = await supabase
    .from('products')
    .update(productPayload(input))
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

export async function uploadProductImage(
  userId: string,
  file: File,
  kind: 'generic' | 'real' = 'generic'
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const folder = kind === 'real' ? 'products/reelles' : 'products';
  const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('product-images').upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}
