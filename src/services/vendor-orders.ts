import { supabase } from '../lib/supabase';
import {
  mapOrder,
  ORDER_STATUS_LABELS,
  ORDER_TIMELINE,
  type OrderStatus,
  type OrderView,
} from './orders';

export interface VendorOrderView extends OrderView {
  customerName: string | null;
  customerPhone: string | null;
}

export interface VendorOrderStats {
  total: number;
  toPrepare: number;
  inDelivery: number;
  delivered: number;
  revenue: number;
}

const ORDER_SELECT = `
  *,
  vendors ( shop_name ),
  profiles ( full_name, phone ),
  order_items (
    id, product_id, quantity, price, total,
    products ( name, main_image, images )
  )
`;

function mapVendorOrder(row: Record<string, unknown>): VendorOrderView {
  const base = mapOrder(row);
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const p = profile as Record<string, unknown> | null | undefined;
  return {
    ...base,
    customerName: p ? ((p.full_name as string) ?? null) : null,
    customerPhone: p ? ((p.phone as string) ?? null) : null,
  };
}

/** Prochaine étape autorisée pour le vendeur */
export function nextVendorStatus(status: OrderStatus): OrderStatus | null {
  const flow: Partial<Record<OrderStatus, OrderStatus>> = {
    pending: 'confirmed',
    confirmed: 'processing',
    processing: 'shipped',
    shipped: 'delivered',
  };
  return flow[status] ?? null;
}

export function canVendorCancel(status: OrderStatus): boolean {
  return status === 'pending' || status === 'confirmed' || status === 'processing';
}

export async function fetchVendorOrders(vendorId: string): Promise<VendorOrderView[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapVendorOrder(row as Record<string, unknown>));
}

export async function fetchVendorOrderById(
  vendorId: string,
  orderId: string
): Promise<VendorOrderView | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', orderId)
    .eq('vendor_id', vendorId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapVendorOrder(data as Record<string, unknown>);
}

export async function fetchVendorOrderStats(vendorId: string): Promise<VendorOrderStats> {
  const { data, error } = await supabase
    .from('orders')
    .select('status, total, payment_status')
    .eq('vendor_id', vendorId);

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const active = rows.filter((r) => r.status !== 'cancelled' && r.status !== 'refunded');

  return {
    total: rows.length,
    toPrepare: rows.filter((r) => r.status === 'confirmed' || r.status === 'processing').length,
    inDelivery: rows.filter((r) => r.status === 'shipped').length,
    delivered: rows.filter((r) => r.status === 'delivered').length,
    revenue: active
      .filter((r) => r.payment_status === 'paid')
      .reduce((s, r) => s + Number(r.total ?? 0), 0),
  };
}

export async function updateVendorOrderStatus(
  vendorId: string,
  orderId: string,
  nextStatus: OrderStatus,
  trackingNumber?: string
): Promise<void> {
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, status, tracking_number')
    .eq('id', orderId)
    .eq('vendor_id', vendorId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!order) throw new Error('Commande introuvable.');

  const expected = nextVendorStatus(order.status as OrderStatus);
  if (expected !== nextStatus) {
    throw new Error(
      `Transition invalide : ${ORDER_STATUS_LABELS[order.status as OrderStatus]} → ${ORDER_STATUS_LABELS[nextStatus]}.`
    );
  }

  if (nextStatus === 'shipped') {
    const tracking = trackingNumber?.trim() || order.tracking_number;
    if (!tracking) {
      throw new Error('Un numéro de suivi est requis pour marquer « En livraison ».');
    }
  }

  const payload: Record<string, unknown> = { status: nextStatus };
  if (trackingNumber?.trim()) {
    payload.tracking_number = trackingNumber.trim();
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', orderId)
    .eq('vendor_id', vendorId);

  if (updateError) throw new Error(updateError.message);
}

export async function cancelVendorOrder(vendorId: string, orderId: string): Promise<void> {
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .eq('vendor_id', vendorId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!order) throw new Error('Commande introuvable.');
  if (!canVendorCancel(order.status as OrderStatus)) {
    throw new Error('Cette commande ne peut plus être annulée.');
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .eq('vendor_id', vendorId);

  if (updateError) throw new Error(updateError.message);
}

export { ORDER_STATUS_LABELS, ORDER_TIMELINE };
