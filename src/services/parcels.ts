import { supabase } from '../lib/supabase';
import { CATALOG_CITIES } from '../types/catalog';

export type ParcelStatus =
  | 'received'
  | 'pickup_scheduled'
  | 'collected'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type ParcelType = 'document' | 'standard' | 'fragile' | 'volumineux';

export interface ParcelInput {
  senderName: string;
  senderPhone: string;
  pickupAddress: string;
  pickupCity: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  parcelType: ParcelType;
  weightKg: number;
  contentDescription: string;
  specialInstructions?: string;
  paymentPhone: string;
}

export interface ParcelView {
  id: string;
  trackingNumber: string;
  userId: string | null;
  senderName: string;
  senderPhone: string;
  pickupAddress: string;
  pickupCity: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  parcelType: string;
  weightKg: number;
  contentDescription: string;
  specialInstructions: string | null;
  price: number;
  status: ParcelStatus;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
}

export const PARCEL_TYPE_LABELS: Record<ParcelType, string> = {
  document: 'Document',
  standard: 'Colis standard',
  fragile: 'Fragile',
  volumineux: 'Volumineux',
};

export const PARCEL_STATUS_LABELS: Record<ParcelStatus, string> = {
  received: 'Enregistré',
  pickup_scheduled: 'Enlèvement planifié',
  collected: 'Collecté',
  in_transit: 'En transit',
  out_for_delivery: 'En cours de livraison',
  delivered: 'Livré',
  cancelled: 'Annulé',
};

export const PARCEL_TIMELINE: ParcelStatus[] = [
  'received',
  'pickup_scheduled',
  'collected',
  'in_transit',
  'out_for_delivery',
  'delivered',
];

export const PARCEL_CITIES = [...CATALOG_CITIES];

const CITY_COUNTRY: Record<string, string> = {
  Dakar: 'SN',
  Ouagadougou: 'BF',
  Bamako: 'ML',
};

const TYPE_SURCHARGE: Record<ParcelType, number> = {
  document: 0,
  standard: 500,
  fragile: 1500,
  volumineux: 2500,
};

/** Estimation tarif MVP (FCFA) */
export function estimateParcelPrice(
  weightKg: number,
  pickupCity: string,
  deliveryCity: string,
  parcelType: ParcelType
): number {
  const weight = Math.max(0.1, weightKg || 0.1);
  const sameCity = pickupCity === deliveryCity;
  const sameCountry = CITY_COUNTRY[pickupCity] === CITY_COUNTRY[deliveryCity];

  let base = 2000;
  if (sameCity) base = 1500;
  else if (sameCountry) base = 3500;
  else base = 5500;

  const weightFee = Math.ceil(weight) * 400;
  const typeFee = TYPE_SURCHARGE[parcelType] ?? 500;
  return base + weightFee + typeFee;
}

function generateTrackingNumber(): string {
  const d = new Date();
  const y = d.getFullYear().toString().slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AZC-${y}${m}${day}-${rand}`;
}

function mapParcel(row: Record<string, unknown>): ParcelView {
  return {
    id: row.id as string,
    trackingNumber: row.tracking_number as string,
    userId: (row.user_id as string) ?? null,
    senderName: row.sender_name as string,
    senderPhone: row.sender_phone as string,
    pickupAddress: row.pickup_address as string,
    pickupCity: row.pickup_city as string,
    recipientName: row.recipient_name as string,
    recipientPhone: row.recipient_phone as string,
    deliveryAddress: row.delivery_address as string,
    deliveryCity: row.delivery_city as string,
    parcelType: row.parcel_type as string,
    weightKg: Number(row.weight_kg),
    contentDescription: row.content_description as string,
    specialInstructions: (row.special_instructions as string) ?? null,
    price: Number(row.price),
    status: row.status as ParcelStatus,
    paymentStatus: (row.payment_status as string) || 'pending',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function createParcel(userId: string, input: ParcelInput): Promise<ParcelView> {
  if (
    !input.senderName.trim() ||
    !input.senderPhone.trim() ||
    !input.pickupAddress.trim() ||
    !input.pickupCity.trim() ||
    !input.recipientName.trim() ||
    !input.recipientPhone.trim() ||
    !input.deliveryAddress.trim() ||
    !input.deliveryCity.trim() ||
    !input.contentDescription.trim()
  ) {
    throw new Error('Tous les champs obligatoires doivent être remplis.');
  }
  if (!input.paymentPhone.trim()) {
    throw new Error('Indiquez le numéro Mobile Money pour payer.');
  }
  if (input.weightKg <= 0 || input.weightKg > 50) {
    throw new Error('Le poids doit être entre 0,1 et 50 kg.');
  }

  const price = estimateParcelPrice(
    input.weightKg,
    input.pickupCity,
    input.deliveryCity,
    input.parcelType
  );
  const trackingNumber = generateTrackingNumber();
  const note = `Payé via Mobile Money (${input.paymentPhone.trim()})`;
  const instructions = [input.specialInstructions?.trim(), note].filter(Boolean).join(' — ');

  const { data, error } = await supabase
    .from('parcel_shipments')
    .insert({
      tracking_number: trackingNumber,
      user_id: userId,
      sender_name: input.senderName.trim(),
      sender_phone: input.senderPhone.trim(),
      pickup_address: input.pickupAddress.trim(),
      pickup_city: input.pickupCity.trim(),
      recipient_name: input.recipientName.trim(),
      recipient_phone: input.recipientPhone.trim(),
      delivery_address: input.deliveryAddress.trim(),
      delivery_city: input.deliveryCity.trim(),
      parcel_type: input.parcelType,
      weight_kg: input.weightKg,
      content_description: input.contentDescription.trim(),
      special_instructions: instructions || null,
      price,
      status: 'received',
      payment_status: 'paid',
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapParcel(data);
}

export async function fetchMyParcels(userId: string): Promise<ParcelView[]> {
  const { data, error } = await supabase
    .from('parcel_shipments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapParcel(row));
}

export async function fetchMyParcelById(
  userId: string,
  parcelId: string
): Promise<ParcelView | null> {
  const { data, error } = await supabase
    .from('parcel_shipments')
    .select('*')
    .eq('id', parcelId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapParcel(data);
}

export async function fetchParcelByTracking(tracking: string): Promise<ParcelView | null> {
  const { data, error } = await supabase.rpc('get_parcel_by_tracking', {
    p_tracking: tracking.trim(),
  });

  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return mapParcel(row as Record<string, unknown>);
}

export async function cancelParcel(userId: string, parcelId: string): Promise<void> {
  const { data: parcel, error } = await supabase
    .from('parcel_shipments')
    .select('id, status')
    .eq('id', parcelId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!parcel) throw new Error('Colis introuvable.');
  if (parcel.status !== 'received' && parcel.status !== 'pickup_scheduled') {
    throw new Error('Ce colis ne peut plus être annulé.');
  }

  const { error: updateError } = await supabase
    .from('parcel_shipments')
    .update({ status: 'cancelled' })
    .eq('id', parcelId)
    .eq('user_id', userId);

  if (updateError) throw new Error(updateError.message);
}

export function nextParcelStatus(status: ParcelStatus): ParcelStatus | null {
  const idx = PARCEL_TIMELINE.indexOf(status);
  if (idx < 0 || idx >= PARCEL_TIMELINE.length - 1) return null;
  return PARCEL_TIMELINE[idx + 1];
}

export async function fetchAllParcelsAdmin(): Promise<ParcelView[]> {
  const { data, error } = await supabase
    .from('parcel_shipments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapParcel(row));
}

export async function updateParcelStatusAdmin(
  parcelId: string,
  nextStatus: ParcelStatus
): Promise<void> {
  const { data: parcel, error } = await supabase
    .from('parcel_shipments')
    .select('id, status')
    .eq('id', parcelId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!parcel) throw new Error('Colis introuvable.');

  const expected = nextParcelStatus(parcel.status as ParcelStatus);
  if (expected !== nextStatus) {
    throw new Error(
      `Transition invalide : ${PARCEL_STATUS_LABELS[parcel.status as ParcelStatus]} → ${PARCEL_STATUS_LABELS[nextStatus]}.`
    );
  }

  const { error: updateError } = await supabase
    .from('parcel_shipments')
    .update({ status: nextStatus })
    .eq('id', parcelId);

  if (updateError) throw new Error(updateError.message);
}
