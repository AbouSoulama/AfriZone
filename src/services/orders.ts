import { supabase } from '../lib/supabase';
import {
  clearCart,
  estimateItemShipping,
  fetchCartSummary,
  type CartItemRow,
} from './cart';

export type PaymentMethod = 'orange_money' | 'wave';
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface CheckoutInput {
  shippingAddress: string;
  shippingCity: string;
  shippingPhone: string;
  notes?: string;
  paymentMethod: PaymentMethod;
  /** Numéro Mobile Money utilisé pour le paiement */
  paymentPhone: string;
}

export interface OrderItemView {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  total: number;
  productName?: string;
  productImage?: string | null;
}

export interface OrderView {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: number;
  shippingCost: number;
  total: number;
  paymentMethod: string | null;
  paymentStatus: string;
  shippingAddress: string;
  shippingCity: string;
  shippingPhone: string;
  trackingNumber: string | null;
  notes: string | null;
  createdAt: string;
  vendorId: string | null;
  vendorName?: string | null;
  items: OrderItemView[];
}

function generateClientOrderNumber(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AZ-${y}${m}${day}-${rand}`;
}

function groupByVendor(items: CartItemRow[]): Map<string, CartItemRow[]> {
  const map = new Map<string, CartItemRow[]>();
  for (const item of items) {
    const key = item.product.vendor?.id;
    if (!key) throw new Error(`Produit « ${item.product.name} » sans vendeur.`);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  orange_money: 'Orange Money',
  wave: 'Wave',
};

export async function placeOrders(
  userId: string,
  input: CheckoutInput
): Promise<string[]> {
  if (!input.shippingAddress.trim() || !input.shippingCity.trim() || !input.shippingPhone.trim()) {
    throw new Error('Adresse, ville et téléphone sont obligatoires.');
  }
  if (!input.paymentPhone.trim()) {
    throw new Error('Indiquez le numéro Mobile Money pour payer.');
  }
  if (input.paymentMethod !== 'orange_money' && input.paymentMethod !== 'wave') {
    throw new Error('Choisissez Orange Money ou Wave.');
  }

  const cart = await fetchCartSummary(userId);
  if (!cart.items.length) throw new Error('Votre panier est vide.');

  for (const item of cart.items) {
    if (!item.product.isActive) {
      throw new Error(`Le produit « ${item.product.name} » n'est plus disponible.`);
    }
    if (item.quantity > item.product.stock) {
      throw new Error(`Stock insuffisant pour « ${item.product.name} ».`);
    }
  }

  const groups = groupByVendor(cart.items);
  const createdOrderIds: string[] = [];
  const paymentNote = `Payé via ${PAYMENT_METHOD_LABELS[input.paymentMethod]} (${input.paymentPhone.trim()})`;
  const notesParts = [input.notes?.trim(), paymentNote].filter(Boolean);

  for (const [vendorId, items] of groups) {
    const subtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
    const shippingCost = Math.max(...items.map((i) => estimateItemShipping(i.product)));
    const total = subtotal + shippingCost;
    const orderNumber = generateClientOrderNumber();

    // Paiement direct : commande confirmée + payée dès validation (MVP sans passerelle API)
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        user_id: userId,
        vendor_id: vendorId,
        status: 'confirmed',
        subtotal,
        shipping_cost: shippingCost,
        total,
        payment_method: input.paymentMethod,
        payment_status: 'paid',
        shipping_address: input.shippingAddress.trim(),
        shipping_city: input.shippingCity.trim(),
        shipping_phone: input.shippingPhone.trim(),
        notes: notesParts.join(' — ') || null,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    const orderItems = items.map((i) => ({
      order_id: order.id,
      product_id: i.productId,
      quantity: i.quantity,
      price: i.product.price,
      total: i.product.price * i.quantity,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) throw new Error(itemsError.message);

    createdOrderIds.push(order.id);
  }

  await clearCart(userId);
  return createdOrderIds;
}

export async function fetchMyOrders(userId: string): Promise<OrderView[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      *,
      vendors ( shop_name ),
      order_items (
        id, product_id, quantity, price, total,
        products ( name, main_image, images )
      )
    `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapOrder(row as Record<string, unknown>));
}

export async function fetchOrderById(
  userId: string,
  orderId: string
): Promise<OrderView | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      *,
      vendors ( shop_name ),
      order_items (
        id, product_id, quantity, price, total,
        products ( name, main_image, images )
      )
    `
    )
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapOrder(data as Record<string, unknown>);
}

export async function cancelOrder(userId: string, orderId: string): Promise<void> {
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!order) throw new Error('Commande introuvable.');
  if (order.status !== 'pending') {
    throw new Error('Seules les commandes en attente (non payées) peuvent être annulées.');
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .eq('user_id', userId);

  if (updateError) throw new Error(updateError.message);
}

function mapOrder(row: Record<string, unknown>): OrderView {
  const vendor = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;
  const itemsRaw = (row.order_items as Record<string, unknown>[]) ?? [];

  return {
    id: row.id as string,
    orderNumber: row.order_number as string,
    status: row.status as OrderStatus,
    subtotal: Number(row.subtotal),
    shippingCost: Number(row.shipping_cost ?? 0),
    total: Number(row.total),
    paymentMethod: (row.payment_method as string) ?? null,
    paymentStatus: (row.payment_status as string) || 'pending',
    shippingAddress: row.shipping_address as string,
    shippingCity: row.shipping_city as string,
    shippingPhone: row.shipping_phone as string,
    trackingNumber: (row.tracking_number as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    vendorId: (row.vendor_id as string) ?? null,
    vendorName: vendor ? ((vendor as Record<string, unknown>).shop_name as string) : null,
    items: itemsRaw.map((item) => {
      const product = Array.isArray(item.products) ? item.products[0] : item.products;
      const p = product as Record<string, unknown> | null;
      const images = (p?.images as string[]) ?? [];
      return {
        id: item.id as string,
        productId: item.product_id as string,
        quantity: Number(item.quantity),
        price: Number(item.price),
        total: Number(item.total),
        productName: (p?.name as string) || 'Produit',
        productImage: (p?.main_image as string) || images[0] || null,
      };
    }),
  };
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  processing: 'Préparation',
  shipped: 'En livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
};

export const ORDER_TIMELINE: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
];
