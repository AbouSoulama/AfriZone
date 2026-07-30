import { supabase } from '../lib/supabase';
import {
  DELIVERY_STATUS_LABELS,
  DELIVERY_TIMELINE,
  nextDeliveryStatus,
  type DeliveryJobStatus,
  type DeliveryView,
} from './drivers';

function mapDelivery(row: Record<string, unknown>): DeliveryView {
  const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
  const o = order as Record<string, unknown> | null | undefined;
  return {
    id: row.id as string,
    driverId: (row.driver_id as string) || '',
    orderId: (row.order_id as string) ?? null,
    parcelId: (row.parcel_id as string) ?? null,
    status: row.status as DeliveryJobStatus,
    pickupAddress: row.pickup_address as string,
    pickupCity: row.pickup_city as string,
    deliveryAddress: row.delivery_address as string,
    deliveryCity: row.delivery_city as string,
    recipientName: (row.recipient_name as string) ?? null,
    recipientPhone: (row.recipient_phone as string) ?? null,
    notes: (row.notes as string) ?? null,
    assignedAt: row.assigned_at as string,
    acceptedAt: (row.accepted_at as string) ?? null,
    deliveredAt: (row.delivered_at as string) ?? null,
    createdAt: row.created_at as string,
    orderNumber: o ? ((o.order_number as string) ?? null) : null,
    parcelTracking: null,
    kind: 'order',
  };
}

const SELECT = `
  *,
  orders ( order_number )
`;

export async function orderHasVendorDeliveryMode(orderId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('order_items')
    .select('product_id, products ( delivery_mode )')
    .eq('order_id', orderId);

  if (error) throw new Error(error.message);
  return (data ?? []).some((row) => {
    const p = Array.isArray(row.products) ? row.products[0] : row.products;
    return (p as { delivery_mode?: string } | null)?.delivery_mode === 'vendor';
  });
}

export async function startVendorSelfDelivery(orderId: string): Promise<string> {
  const { data, error } = await supabase.rpc('vendor_start_self_delivery', {
    p_order_id: orderId,
  });
  if (error) {
    throw new Error(
      error.message.includes('function') || error.message.includes('schema cache')
        ? 'Livraison vendeur indisponible : exécutez 016_vendor_self_delivery.sql'
        : error.message
    );
  }
  return data as string;
}

export async function fetchVendorDeliveries(vendorId: string): Promise<DeliveryView[]> {
  const { data, error } = await supabase
    .from('deliveries')
    .select(SELECT)
    .eq('vendor_id', vendorId)
    .eq('courier_kind', 'vendor')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapDelivery(r as Record<string, unknown>));
}

export async function fetchVendorDeliveryById(
  vendorId: string,
  deliveryId: string
): Promise<DeliveryView | null> {
  const { data, error } = await supabase
    .from('deliveries')
    .select(SELECT)
    .eq('id', deliveryId)
    .eq('vendor_id', vendorId)
    .eq('courier_kind', 'vendor')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapDelivery(data as Record<string, unknown>);
}

export async function fetchVendorDeliveryByOrder(
  vendorId: string,
  orderId: string
): Promise<DeliveryView | null> {
  const { data, error } = await supabase
    .from('deliveries')
    .select(SELECT)
    .eq('vendor_id', vendorId)
    .eq('order_id', orderId)
    .eq('courier_kind', 'vendor')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapDelivery(data as Record<string, unknown>);
}

export async function updateVendorDeliveryStatus(
  deliveryId: string,
  nextStatus: DeliveryJobStatus
): Promise<void> {
  const { error } = await supabase.rpc('vendor_update_delivery_status', {
    p_delivery_id: deliveryId,
    p_status: nextStatus,
  });
  if (error) throw new Error(error.message);
}

export { DELIVERY_STATUS_LABELS, DELIVERY_TIMELINE, nextDeliveryStatus };
export type { DeliveryJobStatus, DeliveryView };
