import { supabase } from '../lib/supabase';
import type { CatalogProduct, DeliveryMode } from '../types/catalog';

export interface CartItemRow {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  product: CatalogProduct;
}

export interface CartSummary {
  items: CartItemRow[];
  itemCount: number;
  subtotal: number;
  shippingEstimate: number;
  total: number;
}

const AFRIZONE_SHIPPING_FEE = 2000;

function mapProduct(row: Record<string, unknown>): CatalogProduct {
  const vendorRaw = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;
  const vendor = vendorRaw as Record<string, unknown> | null | undefined;
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
    vendor: vendor
      ? {
          id: vendor.id as string,
          shopName: vendor.shop_name as string,
          shopSlug: vendor.shop_slug as string,
          shopDescription: null,
          shopCategory: null,
          shopLogoUrl: (vendor.shop_logo_url as string) ?? null,
          vendorCode: vendor.vendor_code as string,
          country: vendor.country as string,
          city: vendor.city as string,
          rating: Number(vendor.rating ?? 0),
          totalSales: Number(vendor.total_sales ?? 0),
          status: vendor.status as string,
        }
      : null,
  };
}

export function estimateItemShipping(product: CatalogProduct): number {
  if (product.deliveryMode === 'vendor') {
    return Number(product.vendorDeliveryFee ?? 0);
  }
  return AFRIZONE_SHIPPING_FEE;
}

export async function getOrCreateCartId(userId: string): Promise<string> {
  const { data: existing, error } = await supabase
    .from('carts')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (existing?.id) return existing.id;

  const { data: created, error: createError } = await supabase
    .from('carts')
    .insert({ user_id: userId })
    .select('id')
    .single();

  if (createError) throw new Error(createError.message);
  return created.id;
}

export async function fetchCartSummary(userId: string): Promise<CartSummary> {
  const cartId = await getOrCreateCartId(userId);

  const { data, error } = await supabase
    .from('cart_items')
    .select(
      `
      id, cart_id, product_id, quantity,
      products (
        *,
        vendors (
          id, shop_name, shop_slug, shop_logo_url, vendor_code, country, city, rating, total_sales, status
        )
      )
    `
    )
    .eq('cart_id', cartId);

  if (error) throw new Error(error.message);

  const items: CartItemRow[] = (data ?? [])
    .map((row) => {
      const productRaw = Array.isArray(row.products) ? row.products[0] : row.products;
      if (!productRaw) return null;
      return {
        id: row.id as string,
        cartId: row.cart_id as string,
        productId: row.product_id as string,
        quantity: Number(row.quantity),
        product: mapProduct(productRaw as Record<string, unknown>),
      };
    })
    .filter(Boolean) as CartItemRow[];

  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  // Un frais de livraison par vendeur (max des frais des articles du vendeur)
  const shippingByVendor = new Map<string, number>();
  for (const item of items) {
    const vendorId = item.product.vendor?.id || 'unknown';
    const fee = estimateItemShipping(item.product);
    shippingByVendor.set(vendorId, Math.max(shippingByVendor.get(vendorId) ?? 0, fee));
  }
  const shippingEstimate = Array.from(shippingByVendor.values()).reduce((a, b) => a + b, 0);

  return {
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal,
    shippingEstimate,
    total: subtotal + shippingEstimate,
  };
}

export async function addToCart(
  userId: string,
  productId: string,
  quantity = 1
): Promise<void> {
  const cartId = await getOrCreateCartId(userId);

  const { data: existing } = await supabase
    .from('cart_items')
    .select('id, quantity')
    .eq('cart_id', cartId)
    .eq('product_id', productId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: Number(existing.quantity) + quantity })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from('cart_items').insert({
    cart_id: cartId,
    product_id: productId,
    quantity,
  });
  if (error) throw new Error(error.message);
}

export async function updateCartItemQuantity(
  itemId: string,
  quantity: number
): Promise<void> {
  if (quantity <= 0) {
    await removeCartItem(itemId);
    return;
  }
  const { error } = await supabase
    .from('cart_items')
    .update({ quantity })
    .eq('id', itemId);
  if (error) throw new Error(error.message);
}

export async function removeCartItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
  if (error) throw new Error(error.message);
}

export async function clearCart(userId: string): Promise<void> {
  const cartId = await getOrCreateCartId(userId);
  const { error } = await supabase.from('cart_items').delete().eq('cart_id', cartId);
  if (error) throw new Error(error.message);
}
