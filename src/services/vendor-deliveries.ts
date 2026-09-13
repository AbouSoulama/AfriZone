import { supabase } from '../lib/supabase';
import {
  DELIVERY_STATUS_LABELS,
  DELIVERY_TIMELINE,
  nextDeliveryStatus,
  type DeliveryJobStatus,
  type DeliveryView,
} from './drivers';
import { subscribeDeliveryLocation } from './geolocation';

export type CourierKind = 'driver' | 'vendor';

export interface VendorDeliveryView extends DeliveryView {
  courierKind: CourierKind;
  currentLat?: number | null;
  currentLng?: number | null;
  locationUpdatedAt?: string | null;
  driverCode?: string | null;
}

function mapDelivery(row: Record<string, unknown>): VendorDeliveryView {
  const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
  const o = order as Record<string, unknown> | null | undefined;
  const driver = Array.isArray(row.drivers) ? row.drivers[0] : row.drivers;
  const d = driver as Record<string, unknown> | null | undefined;
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
    courierKind: ((row.courier_kind as string) === 'vendor' ? 'vendor' : 'driver') as CourierKind,
    currentLat: row.current_lat != null ? Number(row.current_lat) : null,
    currentLng: row.current_lng != null ? Number(row.current_lng) : null,
    locationUpdatedAt: (row.location_updated_at as string) ?? null,
    driverCode: d ? ((d.driver_code as string) ?? null) : null,
    pickupLat: row.pickup_lat != null ? Number(row.pickup_lat) : null,
    pickupLng: row.pickup_lng != null ? Number(row.pickup_lng) : null,
    deliveryLat: row.delivery_lat != null ? Number(row.delivery_lat) : null,
    deliveryLng: row.delivery_lng != null ? Number(row.delivery_lng) : null,
  };
}

const SELECT = `
  *,
  orders ( order_number, vendor_id ),
  drivers ( driver_code )
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

/** Toutes les courses liées au vendeur (auto-livraison + livreur AfriZone). */
export async function fetchVendorDeliveries(vendorId: string): Promise<VendorDeliveryView[]> {
  const { data, error } = await supabase
    .from('deliveries')
    .select(SELECT)
    .or(`vendor_id.eq.${vendorId},orders.vendor_id.eq.${vendorId}`)
    .order('created_at', { ascending: false });

  if (error) {
    // Fallback si le filtre imbriqué échoue : via vendor_id + commandes du vendeur
    const { data: byVendor, error: e2 } = await supabase
      .from('deliveries')
      .select(SELECT)
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });
    if (e2) throw new Error(error.message);
    const { data: orderIds } = await supabase.from('orders').select('id').eq('vendor_id', vendorId);
    const ids = (orderIds ?? []).map((o) => o.id as string);
    if (!ids.length) return (byVendor ?? []).map((r) => mapDelivery(r as Record<string, unknown>));
    const { data: byOrders, error: e3 } = await supabase
      .from('deliveries')
      .select(SELECT)
      .in('order_id', ids)
      .order('created_at', { ascending: false });
    if (e3) throw new Error(e3.message);
    const map = new Map<string, VendorDeliveryView>();
    for (const r of [...(byVendor ?? []), ...(byOrders ?? [])]) {
      const m = mapDelivery(r as Record<string, unknown>);
      map.set(m.id, m);
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  return (data ?? []).map((r) => mapDelivery(r as Record<string, unknown>));
}

export async function fetchVendorDeliveryById(
  vendorId: string,
  deliveryId: string
): Promise<VendorDeliveryView | null> {
  const { data, error } = await supabase
    .from('deliveries')
    .select(SELECT)
    .eq('id', deliveryId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  const mapped = mapDelivery(data as Record<string, unknown>);
  const orderVendor = Array.isArray((data as { orders?: { vendor_id?: string } }).orders)
    ? ((data as { orders: { vendor_id?: string }[] }).orders[0]?.vendor_id)
    : ((data as { orders?: { vendor_id?: string } }).orders?.vendor_id);
  const owns =
    (data as { vendor_id?: string }).vendor_id === vendorId || orderVendor === vendorId;
  if (!owns) return null;
  return mapped;
}

export async function fetchVendorDeliveryByOrder(
  vendorId: string,
  orderId: string
): Promise<VendorDeliveryView | null> {
  const { data, error } = await supabase
    .from('deliveries')
    .select(SELECT)
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  const mapped = mapDelivery(data as Record<string, unknown>);
  const orderVendor = Array.isArray((data as { orders?: { vendor_id?: string } }).orders)
    ? ((data as { orders: { vendor_id?: string }[] }).orders[0]?.vendor_id)
    : ((data as { orders?: { vendor_id?: string } }).orders?.vendor_id);
  const owns =
    (data as { vendor_id?: string }).vendor_id === vendorId || orderVendor === vendorId;
  if (!owns) return null;
  return mapped;
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

export function subscribeVendorDelivery(
  deliveryId: string,
  onChange: (patch: {
    status: string;
    current_lat: number | null;
    current_lng: number | null;
    location_updated_at: string | null;
  }) => void
) {
  return subscribeDeliveryLocation(deliveryId, onChange);
}

export { DELIVERY_STATUS_LABELS, DELIVERY_TIMELINE, nextDeliveryStatus };
export type { DeliveryJobStatus, DeliveryView };
