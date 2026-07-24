import { supabase } from '../lib/supabase';
import type { VendorStatus } from '../types/auth';

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
  status: VendorStatus;
  driverCode: string;
  vehicleType: VehicleType | string;
  vehiclePlate: string | null;
  city: string;
  country: string;
  zones: string[];
  idDocumentUrl: string | null;
  idDocumentType: string | null;
  licenseNumber: string | null;
  rating: number;
  totalDeliveries: number;
  rejectionReason: string | null;
}

export interface DriverRegisterInput {
  vehicleType: VehicleType;
  vehiclePlate?: string;
  city: string;
  country: 'SN' | 'BF' | 'ML';
  zones: string[];
  licenseNumber?: string;
  idDocumentType: 'cni' | 'passport' | 'permis';
  idDocumentPath: string;
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
}

export const VEHICLE_LABELS: Record<VehicleType, string> = {
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

export const DELIVERY_TIMELINE: DeliveryJobStatus[] = [
  'assigned',
  'accepted',
  'picked_up',
  'in_transit',
  'delivered',
];

export function generateDriverCode(country: string, city: string): string {
  const cityCode = city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3)
    .padEnd(3, 'X');
  const seq = Math.floor(1000 + Math.random() * 9000);
  return `LV-${country}-${cityCode}-${seq}`;
}

export function mapDriver(row: Record<string, unknown>): DriverProfile {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    status: row.status as VendorStatus,
    driverCode: row.driver_code as string,
    vehicleType: row.vehicle_type as string,
    vehiclePlate: (row.vehicle_plate as string) ?? null,
    city: row.city as string,
    country: row.country as string,
    zones: (row.zones as string[]) ?? [],
    idDocumentUrl: (row.id_document_url as string) ?? null,
    idDocumentType: (row.id_document_type as string) ?? null,
    licenseNumber: (row.license_number as string) ?? null,
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
  return data ? mapDriver(data) : null;
}

export async function createDriverApplication(
  userId: string,
  input: DriverRegisterInput
): Promise<DriverProfile> {
  if (!input.zones.length) throw new Error('Indiquez au moins une zone de livraison.');
  if (!input.idDocumentPath) throw new Error('Pièce d’identité requise.');

  const existing = await getDriverForUser(userId);
  if (existing) throw new Error('Vous avez déjà une candidature livreur.');

  const driverCode = generateDriverCode(input.country, input.city);

  const { data, error } = await supabase
    .from('drivers')
    .insert({
      user_id: userId,
      status: 'pending',
      driver_code: driverCode,
      vehicle_type: input.vehicleType,
      vehicle_plate: input.vehiclePlate?.trim() || null,
      city: input.city,
      country: input.country,
      zones: input.zones,
      id_document_url: input.idDocumentPath,
      id_document_type: input.idDocumentType,
      license_number: input.licenseNumber?.trim() || null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  await supabase.from('profiles').update({ role: 'livreur' }).eq('id', userId);

  return mapDriver(data);
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
  nextStatus: DeliveryJobStatus
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
  } else {
    const expected = nextDeliveryStatus(current);
    if (expected !== nextStatus) {
      throw new Error(
        `Transition invalide : ${DELIVERY_STATUS_LABELS[current]} → ${DELIVERY_STATUS_LABELS[nextStatus]}.`
      );
    }
  }

  const payload: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === 'accepted') payload.accepted_at = new Date().toISOString();
  if (nextStatus === 'delivered') payload.delivered_at = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('deliveries')
    .update(payload)
    .eq('id', deliveryId)
    .eq('driver_id', driverId);

  if (updateError) throw new Error(updateError.message);

  // Sync order / parcel statuses
  if (delivery.order_id) {
    let orderStatus: string | null = null;
    if (nextStatus === 'picked_up' || nextStatus === 'in_transit') orderStatus = 'shipped';
    if (nextStatus === 'delivered') orderStatus = 'delivered';
    if (orderStatus) {
      await supabase.from('orders').update({ status: orderStatus }).eq('id', delivery.order_id);
    }
  }

  if (delivery.parcel_id) {
    let parcelStatus: string | null = null;
    if (nextStatus === 'accepted') parcelStatus = 'pickup_scheduled';
    if (nextStatus === 'picked_up') parcelStatus = 'collected';
    if (nextStatus === 'in_transit') parcelStatus = 'in_transit';
    if (nextStatus === 'delivered') parcelStatus = 'delivered';
    if (parcelStatus) {
      await supabase
        .from('parcel_shipments')
        .update({ status: parcelStatus })
        .eq('id', delivery.parcel_id);
    }
  }
}

export async function fetchDriverStats(driverId: string) {
  const { data, error } = await supabase
    .from('deliveries')
    .select('status')
    .eq('driver_id', driverId);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  return {
    total: rows.length,
    active: rows.filter((r) =>
      ['assigned', 'accepted', 'picked_up', 'in_transit'].includes(r.status as string)
    ).length,
    delivered: rows.filter((r) => r.status === 'delivered').length,
    assigned: rows.filter((r) => r.status === 'assigned').length,
  };
}
