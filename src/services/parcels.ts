import { supabase } from '../lib/supabase';
import { coordsForCity, haversineKm, type LatLng } from '../lib/geo';
import {
  CITIES_BY_COUNTRY,
  capitalForCountry,
  countryCodeFromLabelOrCity,
  type CatalogCountryCode,
} from '../types/catalog';

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
  pickupLat?: number | null;
  pickupLng?: number | null;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  parcelType: ParcelType;
  weightKg: number;
  contentDescription: string;
  specialInstructions?: string;
  paymentPhone: string;
  paymentMethod?: string;
  paymentTransactionId?: string;
  markPaid?: boolean;
}

export interface ParcelView {
  id: string;
  trackingNumber: string;
  userId: string | null;
  senderName: string;
  senderPhone: string;
  pickupAddress: string;
  pickupCity: string;
  pickupLat: number | null;
  pickupLng: number | null;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
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

/** Détail transparent du tarif colis (kg + km). */
export interface ParcelQuote {
  totalXof: number;
  distanceKm: number;
  billedKm: number;
  weightKg: number;
  billedKg: number;
  baseXof: number;
  distanceXof: number;
  weightXof: number;
  typeXof: number;
  ratePerKm: number;
  ratePerKg: number;
  usedGps: boolean;
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

/** @deprecated utiliser citiesForParcelCountry */
export const PARCEL_CITIES = Object.values(CITIES_BY_COUNTRY).flat();

/** Prise en charge fixe (enregistrement + premier km) */
export const PARCEL_BASE_XOF = 1000;
/** Tarif au kilomètre (distance GPS ou centroïdes villes) */
export const PARCEL_RATE_PER_KM = 75;
/** Tarif au kilogramme (arrondi au kg supérieur) */
export const PARCEL_RATE_PER_KG = 400;
/** Kilomètres minimum facturés (même ville / trajet court) */
export const PARCEL_MIN_BILLED_KM = 3;
/** Total minimum */
export const PARCEL_MIN_TOTAL_XOF = 1500;

const TYPE_SURCHARGE: Record<ParcelType, number> = {
  document: 0,
  standard: 500,
  fragile: 1500,
  volumineux: 2500,
};

export function citiesForParcelCountry(code: CatalogCountryCode): string[] {
  return CITIES_BY_COUNTRY[code] ?? CITIES_BY_COUNTRY.SN;
}

export function defaultParcelCity(code: CatalogCountryCode): string {
  return capitalForCountry(code);
}

function resolvePoint(
  city: string,
  lat?: number | null,
  lng?: number | null
): { point: LatLng | null; usedGps: boolean } {
  if (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  ) {
    return { point: { lat, lng }, usedGps: true };
  }
  return { point: coordsForCity(city), usedGps: false };
}

/**
 * Tarification transparente :
 * prise en charge + (km × 75 FCFA) + (kg × 400 FCFA) + surcoût type.
 * Distance = GPS si disponible, sinon centroïdes des villes.
 */
export function quoteParcel(input: {
  weightKg: number;
  pickupCity: string;
  deliveryCity: string;
  parcelType: ParcelType;
  pickupLat?: number | null;
  pickupLng?: number | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
}): ParcelQuote {
  const weight = Math.max(0.1, input.weightKg || 0.1);
  const billedKg = Math.max(1, Math.ceil(weight));

  const from = resolvePoint(input.pickupCity, input.pickupLat, input.pickupLng);
  const to = resolvePoint(input.deliveryCity, input.deliveryLat, input.deliveryLng);

  let distanceKm = 0;
  if (from.point && to.point) {
    distanceKm = haversineKm(from.point, to.point);
  } else {
    // Repli : même ville ≈ 5 km, sinon estimation large
    distanceKm =
      input.pickupCity.trim().toLowerCase() === input.deliveryCity.trim().toLowerCase()
        ? 5
        : 120;
  }

  const billedKm = Math.max(PARCEL_MIN_BILLED_KM, Math.round(distanceKm));
  const baseXof = PARCEL_BASE_XOF;
  const distanceXof = billedKm * PARCEL_RATE_PER_KM;
  const weightXof = billedKg * PARCEL_RATE_PER_KG;
  const typeXof = TYPE_SURCHARGE[input.parcelType] ?? 500;
  const raw = baseXof + distanceXof + weightXof + typeXof;
  const totalXof = Math.max(PARCEL_MIN_TOTAL_XOF, raw);

  return {
    totalXof,
    distanceKm: Math.round(distanceKm * 10) / 10,
    billedKm,
    weightKg: weight,
    billedKg,
    baseXof,
    distanceXof,
    weightXof,
    typeXof,
    ratePerKm: PARCEL_RATE_PER_KM,
    ratePerKg: PARCEL_RATE_PER_KG,
    usedGps: from.usedGps && to.usedGps,
  };
}

/** Estimation tarif (FCFA) — total uniquement. */
export function estimateParcelPrice(
  weightKg: number,
  pickupCity: string,
  deliveryCity: string,
  parcelType: ParcelType,
  coords?: {
    pickupLat?: number | null;
    pickupLng?: number | null;
    deliveryLat?: number | null;
    deliveryLng?: number | null;
  }
): number {
  return quoteParcel({
    weightKg,
    pickupCity,
    deliveryCity,
    parcelType,
    pickupLat: coords?.pickupLat,
    pickupLng: coords?.pickupLng,
    deliveryLat: coords?.deliveryLat,
    deliveryLng: coords?.deliveryLng,
  }).totalXof;
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
    pickupLat: row.pickup_lat != null ? Number(row.pickup_lat) : null,
    pickupLng: row.pickup_lng != null ? Number(row.pickup_lng) : null,
    recipientName: row.recipient_name as string,
    recipientPhone: row.recipient_phone as string,
    deliveryAddress: row.delivery_address as string,
    deliveryCity: row.delivery_city as string,
    deliveryLat: row.delivery_lat != null ? Number(row.delivery_lat) : null,
    deliveryLng: row.delivery_lng != null ? Number(row.delivery_lng) : null,
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
    throw new Error('Indiquez le numéro de paiement.');
  }
  if (input.weightKg <= 0 || input.weightKg > 50) {
    throw new Error('Le poids doit être entre 0,1 et 50 kg.');
  }

  const quote = quoteParcel({
    weightKg: input.weightKg,
    pickupCity: input.pickupCity,
    deliveryCity: input.deliveryCity,
    parcelType: input.parcelType,
    pickupLat: input.pickupLat,
    pickupLng: input.pickupLng,
    deliveryLat: input.deliveryLat,
    deliveryLng: input.deliveryLng,
  });
  const price = quote.totalXof;
  const trackingNumber = generateTrackingNumber();
  const methodLabel =
    input.paymentMethod === 'wave'
      ? 'Wave'
      : input.paymentMethod === 'orange_money'
        ? 'Orange Money'
        : input.paymentMethod === 'moov_money'
          ? 'Moov Money'
          : input.paymentMethod === 'mtn_money'
            ? 'MTN Money'
            : 'Mobile Money';
  const paid = input.markPaid !== false;
  const note = `${paid ? 'Payé' : 'Paiement en cours'} via ${methodLabel} (${input.paymentPhone.trim()})${
    input.paymentTransactionId ? ` · réf. ${input.paymentTransactionId}` : ''
  }`;
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
      pickup_lat: input.pickupLat ?? null,
      pickup_lng: input.pickupLng ?? null,
      recipient_name: input.recipientName.trim(),
      recipient_phone: input.recipientPhone.trim(),
      delivery_address: input.deliveryAddress.trim(),
      delivery_city: input.deliveryCity.trim(),
      delivery_lat: input.deliveryLat ?? null,
      delivery_lng: input.deliveryLng ?? null,
      parcel_type: input.parcelType,
      weight_kg: input.weightKg,
      content_description: input.contentDescription.trim(),
      special_instructions: instructions || null,
      price,
      status: 'received',
      payment_status: paid ? 'paid' : 'pending',
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(
      error.message.includes('pickup_lat') || error.message.includes('column')
        ? 'GPS colis indisponible : exécutez la migration 029_parcel_gps.sql'
        : error.message
    );
  }
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

export async function fetchAllParcelsAdmin(
  country?: string | 'ALL'
): Promise<ParcelView[]> {
  const { data, error } = await supabase
    .from('parcel_shipments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((row) => mapParcel(row));
  if (!country || country === 'ALL') return rows;

  return rows.filter((p) => {
    const from = countryCodeFromLabelOrCity(p.pickupCity);
    const to = countryCodeFromLabelOrCity(p.deliveryCity);
    return from === country || to === country;
  });
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
