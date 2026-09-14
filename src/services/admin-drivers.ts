import { supabase } from '../lib/supabase';
import {
  mapDriver,
  type DeliveryView,
  type DriverProfile,
  type DeliveryJobStatus,
} from './drivers';
import type { VendorStatus } from '../types/auth';

export interface AdminDriverRow extends DriverProfile {
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  createdAt: string;
  isOnline: boolean;
  onlineUpdatedAt: string | null;
  lastLat: number | null;
  lastLng: number | null;
  lastLocationAt: string | null;
}

function mapDeliveryAdmin(row: Record<string, unknown>): DeliveryView & {
  driverCode?: string | null;
  driverName?: string | null;
} {
  const driver = Array.isArray(row.drivers) ? row.drivers[0] : row.drivers;
  const d = driver as Record<string, unknown> | null | undefined;
  const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
  const parcel = Array.isArray(row.parcel_shipments)
    ? row.parcel_shipments[0]
    : row.parcel_shipments;
  const o = order as Record<string, unknown> | null | undefined;
  const p = parcel as Record<string, unknown> | null | undefined;

  return {
    id: row.id as string,
    driverId: row.driver_id as string,
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
    parcelTracking: p ? ((p.tracking_number as string) ?? null) : null,
    kind: row.order_id ? 'order' : 'parcel',
    driverCode: d ? ((d.driver_code as string) ?? null) : null,
    batchId: (row.batch_id as string) ?? null,
    offeredFee: row.offered_fee != null ? Number(row.offered_fee) : null,
    acceptDeadlineAt: (row.accept_deadline_at as string) ?? null,
    startDeadlineAt: (row.start_deadline_at as string) ?? null,
    proofPhotoUrl: (row.proof_photo_url as string) ?? null,
    driverName: null,
  };
}

export async function fetchDriversForAdmin(
  status?: VendorStatus | 'all',
  country?: string | 'ALL'
): Promise<AdminDriverRow[]> {
  let query = supabase.from('drivers').select('*').order('created_at', { ascending: false });
  if (status && status !== 'all') query = query.eq('status', status);
  if (country && country !== 'ALL') query = query.eq('country', country);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const userIds = rows.map((r) => r.user_id as string);
  let profilesById: Record<string, { full_name?: string; phone?: string; email?: string }> = {};
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, phone, email')
      .in('id', userIds);
    profilesById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  }

  return rows
    .map((row) => {
      const base = mapDriver(row);
      const profile = profilesById[row.user_id as string];
      return {
        ...base,
        createdAt: row.created_at as string,
        ownerName: profile?.full_name ?? null,
        ownerPhone: profile?.phone ?? null,
        ownerEmail: profile?.email ?? null,
        isOnline: Boolean(row.is_online),
        onlineUpdatedAt: (row.online_updated_at as string) ?? null,
        lastLat: row.last_lat != null ? Number(row.last_lat) : null,
        lastLng: row.last_lng != null ? Number(row.last_lng) : null,
        lastLocationAt: (row.last_location_at as string) ?? null,
      };
    })
    .sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (b.isOnline && !a.isOnline) return 1;
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

export async function updateDriverStatus(
  driverId: string,
  status: VendorStatus,
  adminId: string,
  rejectionReason?: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    status,
    rejection_reason: rejectionReason || null,
  };
  if (status === 'approved') {
    payload.approved_at = new Date().toISOString();
    payload.approved_by = adminId;
  } else {
    payload.approved_at = null;
    payload.approved_by = null;
  }

  const { error } = await supabase.from('drivers').update(payload).eq('id', driverId);
  if (error) throw new Error(error.message);
}

export async function deleteDriverAdmin(driverId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_driver', {
    p_driver_id: driverId,
  });
  if (error) {
    throw new Error(
      error.message.includes('function') || error.message.includes('schema cache')
        ? 'Suppression livreur indisponible : exécutez la migration 015_fix_admin_deletes.sql'
        : error.message
    );
  }
}

export async function fetchApprovedDrivers(country?: string | 'ALL'): Promise<DriverProfile[]> {
  let query = supabase.from('drivers').select('*').eq('status', 'approved').order('city');
  if (country && country !== 'ALL') query = query.eq('country', country);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapDriver(row));
}

export async function fetchAssignableOrders(country?: string | 'ALL') {
  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, status, shipping_address, shipping_city, shipping_country, shipping_phone, total, created_at, vendors(country)'
    )
    .in('status', ['confirmed', 'processing', 'shipped'])
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message);

  const { data: active } = await supabase
    .from('deliveries')
    .select('order_id')
    .not('order_id', 'is', null)
    .not('status', 'in', '(refused,cancelled,delivered)');

  const taken = new Set((active ?? []).map((d) => d.order_id as string));
  return (orders ?? []).filter((o) => {
    if (taken.has(o.id)) return false;
    if (!country || country === 'ALL') return true;
    const sc = String((o as { shipping_country?: string }).shipping_country || '').toUpperCase();
    if (sc === country) return true;
    const vendors = (o as { vendors?: { country?: string } | { country?: string }[] }).vendors;
    const v = Array.isArray(vendors) ? vendors[0] : vendors;
    return String(v?.country || '').toUpperCase() === country;
  });
}

export async function fetchAssignableParcels() {
  const { data: parcels, error } = await supabase
    .from('parcel_shipments')
    .select(
      'id, tracking_number, status, pickup_address, pickup_city, delivery_address, delivery_city, recipient_name, recipient_phone, price, created_at'
    )
    .in('status', ['received', 'pickup_scheduled', 'collected', 'in_transit'])
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);

  const { data: active } = await supabase
    .from('deliveries')
    .select('parcel_id')
    .not('parcel_id', 'is', null)
    .not('status', 'in', '(refused,cancelled,delivered)');

  const taken = new Set((active ?? []).map((d) => d.parcel_id as string));
  return (parcels ?? []).filter((p) => !taken.has(p.id));
}

export async function assignOrderToDriver(
  adminId: string,
  orderId: string,
  driverId: string,
  offeredFee?: number
): Promise<void> {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) throw new Error('Commande introuvable.');

  const fee =
    offeredFee != null && Number.isFinite(offeredFee) ? Math.round(offeredFee) : null;
  const deadline = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase.from('deliveries').insert({
    driver_id: driverId,
    order_id: orderId,
    parcel_id: null,
    vendor_id: order.vendor_id ?? null,
    courier_kind: 'driver',
    status: 'assigned',
    pickup_address: 'Entrepôt / vendeur AfriZone',
    pickup_city: order.shipping_city,
    delivery_address: order.shipping_address,
    delivery_city: order.shipping_city,
    delivery_lat: order.shipping_lat != null ? Number(order.shipping_lat) : null,
    delivery_lng: order.shipping_lng != null ? Number(order.shipping_lng) : null,
    recipient_name: null,
    recipient_phone: order.shipping_phone,
    assigned_by: adminId,
    offered_fee: fee,
    accept_deadline_at: deadline,
  });
  if (insertError) throw new Error(insertError.message);

  if (order.status === 'confirmed' || order.status === 'processing') {
    await supabase.from('orders').update({ status: 'processing' }).eq('id', orderId);
  }
}

/** Assigne plusieurs commandes en un lot avec un prix fixe pour le livreur. */
export async function createDeliveryBatch(
  driverId: string,
  orderIds: string[],
  offeredFee: number,
  notes?: string
): Promise<string> {
  const { data, error } = await supabase.rpc('admin_create_delivery_batch', {
    p_driver_id: driverId,
    p_order_ids: orderIds,
    p_offered_fee: Math.round(offeredFee),
    p_notes: notes || null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function reclaimDelivery(deliveryId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_reclaim_overdue_deliveries', {
    p_batch_id: null,
    p_delivery_id: deliveryId,
  });
  if (error) throw new Error(error.message);
}

export async function reclaimBatch(batchId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_reclaim_overdue_deliveries', {
    p_batch_id: batchId,
    p_delivery_id: null,
  });
  if (error) throw new Error(error.message);
}

export function isDeliveryOverdue(d: {
  status: string;
  assignedAt?: string;
  acceptedAt?: string | null;
  acceptDeadlineAt?: string | null;
  startDeadlineAt?: string | null;
}): boolean {
  const now = Date.now();
  if (d.status === 'assigned') {
    const deadline = d.acceptDeadlineAt
      ? new Date(d.acceptDeadlineAt).getTime()
      : d.assignedAt
        ? new Date(d.assignedAt).getTime() + 2 * 60 * 60 * 1000
        : 0;
    return deadline > 0 && now > deadline;
  }
  if (d.status === 'accepted') {
    const deadline = d.startDeadlineAt
      ? new Date(d.startDeadlineAt).getTime()
      : d.acceptedAt
        ? new Date(d.acceptedAt).getTime() + 2 * 60 * 60 * 1000
        : 0;
    return deadline > 0 && now > deadline;
  }
  return false;
}

export async function assignParcelToDriver(
  adminId: string,
  parcelId: string,
  driverId: string
): Promise<void> {
  const { data: parcel, error } = await supabase
    .from('parcel_shipments')
    .select('*')
    .eq('id', parcelId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!parcel) throw new Error('Colis introuvable.');

  const { error: insertError } = await supabase.from('deliveries').insert({
    driver_id: driverId,
    order_id: null,
    parcel_id: parcelId,
    status: 'assigned',
    pickup_address: parcel.pickup_address,
    pickup_city: parcel.pickup_city,
    delivery_address: parcel.delivery_address,
    delivery_city: parcel.delivery_city,
    recipient_name: parcel.recipient_name,
    recipient_phone: parcel.recipient_phone,
    assigned_by: adminId,
  });
  if (insertError) throw new Error(insertError.message);
}

export async function fetchAllDeliveriesAdmin(): Promise<
  (DeliveryView & { driverCode?: string | null })[]
> {
  const { data, error } = await supabase
    .from('deliveries')
    .select(
      `
      *,
      drivers ( driver_code ),
      orders ( order_number ),
      parcel_shipments ( tracking_number )
    `
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapDeliveryAdmin(row as Record<string, unknown>));
}

export async function getDriverDocumentUrl(path: string): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const { data, error } = await supabase.storage
    .from('vendor-documents')
    .createSignedUrl(path, 60 * 10);
  if (error) {
    console.error(error);
    return null;
  }
  return data.signedUrl;
}
