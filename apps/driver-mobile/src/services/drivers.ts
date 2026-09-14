import { supabase } from '../lib/supabase';
import { coordsForCity, estimateEtaMinutes, haversineKm } from '../lib/geo';

export type VehicleType = 'moto' | 'voiture' | 'velo' | 'camionnette';
export type DeliveryJobStatus =
  | 'assigned'
  | 'accepted'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'refused'
  | 'cancelled';

export interface DriverProfile {
  id: string;
  userId: string;
  status: string;
  driverCode: string;
  vehicleType: string;
  vehiclePlate: string | null;
  city: string;
  country: string;
  zones: string[];
  rating: number;
  totalDeliveries: number;
  rejectionReason: string | null;
}

export interface DeliveryView {
  id: string;
  driverId: string;
  orderId: string | null;
  parcelId: string | null;
  status: DeliveryJobStatus;
  pickupAddress: string;
  pickupCity: string;
  deliveryAddress: string;
  deliveryCity: string;
  recipientName: string | null;
  recipientPhone: string | null;
  notes: string | null;
  assignedAt: string;
  acceptedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  orderNumber?: string | null;
  parcelTracking?: string | null;
  kind: 'order' | 'parcel';
  currentLat?: number | null;
  currentLng?: number | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  batchId?: string | null;
  offeredFee?: number | null;
  acceptDeadlineAt?: string | null;
  startDeadlineAt?: string | null;
  proofPhotoUrl?: string | null;
}

export const VEHICLE_LABELS: Record<string, string> = {
  moto: 'Moto',
  voiture: 'Voiture',
  velo: 'Vélo',
  camionnette: 'Camionnette',
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryJobStatus, string> = {
  assigned: 'Assignée',
  accepted: 'Acceptée',
  picked_up: 'Collectée',
  in_transit: 'En route',
  delivered: 'Livrée',
  refused: 'Refusée',
  cancelled: 'Annulée',
};

export function mapDriver(row: Record<string, unknown>): DriverProfile {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    status: row.status as string,
    driverCode: row.driver_code as string,
    vehicleType: row.vehicle_type as string,
    vehiclePlate: (row.vehicle_plate as string) ?? null,
    city: row.city as string,
    country: row.country as string,
    zones: (row.zones as string[]) ?? [],
    rating: Number(row.rating ?? 0),
    totalDeliveries: Number(row.total_deliveries ?? 0),
    rejectionReason: (row.rejection_reason as string) ?? null,
  };
}

function mapDelivery(row: Record<string, unknown>): DeliveryView {
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
    currentLat: row.current_lat != null ? Number(row.current_lat) : null,
    currentLng: row.current_lng != null ? Number(row.current_lng) : null,
    pickupLat: row.pickup_lat != null ? Number(row.pickup_lat) : null,
    pickupLng: row.pickup_lng != null ? Number(row.pickup_lng) : null,
    deliveryLat: row.delivery_lat != null ? Number(row.delivery_lat) : null,
    deliveryLng: row.delivery_lng != null ? Number(row.delivery_lng) : null,
    batchId: (row.batch_id as string) ?? null,
    offeredFee: row.offered_fee != null ? Number(row.offered_fee) : null,
    acceptDeadlineAt: (row.accept_deadline_at as string) ?? null,
    startDeadlineAt: (row.start_deadline_at as string) ?? null,
    proofPhotoUrl: (row.proof_photo_url as string) ?? null,
  };
}

export function nextDeliveryStatus(status: DeliveryJobStatus): DeliveryJobStatus | null {
  const flow: Partial<Record<DeliveryJobStatus, DeliveryJobStatus>> = {
    assigned: 'accepted',
    accepted: 'picked_up',
    picked_up: 'in_transit',
    in_transit: 'delivered',
  };
  return flow[status] ?? null;
}

export async function getDriverForUser(userId: string): Promise<DriverProfile | null> {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapDriver(data as Record<string, unknown>) : null;
}

export async function fetchDriverDeliveries(driverId: string): Promise<DeliveryView[]> {
  const { data, error } = await supabase
    .from('deliveries')
    .select(
      `
      *,
      orders ( order_number ),
      parcel_shipments ( tracking_number )
    `
    )
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapDelivery(row as Record<string, unknown>));
}

export async function fetchDriverDeliveryById(
  driverId: string,
  deliveryId: string
): Promise<DeliveryView | null> {
  const { data, error } = await supabase
    .from('deliveries')
    .select(
      `
      *,
      orders ( order_number ),
      parcel_shipments ( tracking_number )
    `
    )
    .eq('id', deliveryId)
    .eq('driver_id', driverId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapDelivery(data as Record<string, unknown>);
}

export async function updateDeliveryStatusByDriver(
  driverId: string,
  deliveryId: string,
  nextStatus: DeliveryJobStatus,
  opts?: { proofPhotoUrl?: string }
): Promise<void> {
  const { data: delivery, error } = await supabase
    .from('deliveries')
    .select('*')
    .eq('id', deliveryId)
    .eq('driver_id', driverId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!delivery) throw new Error('Course introuvable.');

  const current = delivery.status as DeliveryJobStatus;

  if (nextStatus === 'refused') {
    if (current !== 'assigned') {
      throw new Error('Seule une course assignée peut être refusée.');
    }
    if (delivery.batch_id) {
      const { error: batchErr } = await supabase.rpc('driver_respond_batch', {
        p_batch_id: delivery.batch_id,
        p_accept: false,
      });
      if (batchErr) throw new Error(batchErr.message);
      return;
    }
  } else if (nextStatus === 'accepted' && current === 'assigned' && delivery.batch_id) {
    const { error: batchErr } = await supabase.rpc('driver_respond_batch', {
      p_batch_id: delivery.batch_id,
      p_accept: true,
    });
    if (batchErr) throw new Error(batchErr.message);
    return;
  } else {
    const expected = nextDeliveryStatus(current);
    if (expected !== nextStatus) {
      throw new Error(
        `Transition invalide : ${DELIVERY_STATUS_LABELS[current]} → ${DELIVERY_STATUS_LABELS[nextStatus]}.`
      );
    }
  }

  if (nextStatus === 'delivered' && !opts?.proofPhotoUrl && !delivery.proof_photo_url) {
    throw new Error('Photo de preuve obligatoire pour valider la livraison.');
  }

  const payload: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === 'accepted') {
    payload.accepted_at = new Date().toISOString();
    payload.start_deadline_at = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  }
  if (nextStatus === 'delivered') {
    payload.delivered_at = new Date().toISOString();
    if (opts?.proofPhotoUrl) {
      payload.proof_photo_url = opts.proofPhotoUrl;
      payload.proof_photo_at = new Date().toISOString();
    }
  }

  const { error: updateError } = await supabase
    .from('deliveries')
    .update(payload)
    .eq('id', deliveryId)
    .eq('driver_id', driverId);

  if (updateError) throw new Error(updateError.message);

  if (delivery.order_id) {
    let orderStatus: string | null = null;
    if (nextStatus === 'picked_up' || nextStatus === 'in_transit') orderStatus = 'shipped';
    if (nextStatus === 'delivered') orderStatus = 'delivered';
    if (orderStatus) {
      const { error: orderErr } = await supabase
        .from('orders')
        .update({ status: orderStatus })
        .eq('id', delivery.order_id);
      if (orderErr) throw new Error(`Statut commande : ${orderErr.message}`);
    }
  }

  if (delivery.parcel_id) {
    let parcelStatus: string | null = null;
    if (nextStatus === 'accepted') parcelStatus = 'pickup_scheduled';
    if (nextStatus === 'picked_up') parcelStatus = 'collected';
    if (nextStatus === 'in_transit') parcelStatus = 'in_transit';
    if (nextStatus === 'delivered') parcelStatus = 'delivered';
    if (parcelStatus) {
      const { error: parcelErr } = await supabase
        .from('parcel_shipments')
        .update({ status: parcelStatus })
        .eq('id', delivery.parcel_id);
      if (parcelErr) throw new Error(`Statut colis : ${parcelErr.message}`);
    }
  }
}

export async function uploadDeliveryProof(
  userId: string,
  deliveryId: string,
  localUri: string,
  mimeType = 'image/jpeg'
): Promise<string> {
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const path = `${userId}/proofs/${deliveryId}-${Date.now()}.${ext}`;
  const response = await fetch(localUri);
  const blob = await response.blob();
  const arrayBuffer = await new Response(blob).arrayBuffer();
  const { error } = await supabase.storage.from('delivery-proofs').upload(path, arrayBuffer, {
    upsert: true,
    contentType: mimeType,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('delivery-proofs').getPublicUrl(path);
  return data.publicUrl;
}

export async function fetchDriverStats(driverId: string) {
  const { data, error } = await supabase
    .from('deliveries')
    .select('status, delivered_at, created_at')
    .eq('driver_id', driverId);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayIso = startOfDay.toISOString();

  return {
    total: rows.length,
    active: rows.filter((r) =>
      ['assigned', 'accepted', 'picked_up', 'in_transit'].includes(r.status as string)
    ).length,
    delivered: rows.filter((r) => r.status === 'delivered').length,
    assigned: rows.filter((r) => r.status === 'assigned').length,
    deliveredToday: rows.filter(
      (r) =>
        r.status === 'delivered' &&
        r.delivered_at &&
        String(r.delivered_at) >= todayIso
    ).length,
  };
}

export async function prepareDeliveryRoute(
  deliveryId: string,
  pickupCity: string,
  deliveryCity: string,
  vehicleType?: string | null,
  /** GPS client déjà sur la course — ne pas écraser par le centroïde ville */
  preserveDropoff?: { lat: number; lng: number } | null
): Promise<{ distanceKm: number; etaMinutes: number } | null> {
  const pickup = coordsForCity(pickupCity);
  const dropoff = preserveDropoff ?? coordsForCity(deliveryCity);
  if (!pickup || !dropoff) return null;

  const distanceKm = Math.round(haversineKm(pickup, dropoff) * 10) / 10;
  const etaMinutes = estimateEtaMinutes(distanceKm, vehicleType);

  await supabase
    .from('deliveries')
    .update({
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      delivery_lat: dropoff.lat,
      delivery_lng: dropoff.lng,
      route_distance_km: distanceKm,
      route_eta_minutes: etaMinutes,
    })
    .eq('id', deliveryId);

  return { distanceKm, etaMinutes };
}

export async function pushDeliveryLocation(
  deliveryId: string,
  lat: number,
  lng: number
): Promise<void> {
  const { error } = await supabase.rpc('update_delivery_location', {
    p_delivery_id: deliveryId,
    p_lat: lat,
    p_lng: lng,
  });
  if (error) throw new Error(error.message);
}
