import { supabase } from '../lib/supabase';
import {
  coordsForCity,
  estimateEtaMinutes,
  haversineKm,
  type LatLng,
} from '../lib/geo';
import type { DeliveryJobStatus, DeliveryView } from './drivers';

export interface LiveDeliveryView extends DeliveryView {
  currentLat: number | null;
  currentLng: number | null;
  locationUpdatedAt: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  routeDistanceKm: number | null;
  routeEtaMinutes: number | null;
  driverCode?: string | null;
  vehicleType?: string | null;
}

function mapLive(row: Record<string, unknown>): LiveDeliveryView {
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
    currentLat: row.current_lat != null ? Number(row.current_lat) : null,
    currentLng: row.current_lng != null ? Number(row.current_lng) : null,
    locationUpdatedAt: (row.location_updated_at as string) ?? null,
    pickupLat: row.pickup_lat != null ? Number(row.pickup_lat) : null,
    pickupLng: row.pickup_lng != null ? Number(row.pickup_lng) : null,
    deliveryLat: row.delivery_lat != null ? Number(row.delivery_lat) : null,
    deliveryLng: row.delivery_lng != null ? Number(row.delivery_lng) : null,
    routeDistanceKm: row.route_distance_km != null ? Number(row.route_distance_km) : null,
    routeEtaMinutes: row.route_eta_minutes != null ? Number(row.route_eta_minutes) : null,
    driverCode: d ? ((d.driver_code as string) ?? null) : null,
    vehicleType: d ? ((d.vehicle_type as string) ?? null) : null,
  };
}

const LIVE_SELECT = `
  *,
  drivers ( driver_code, vehicle_type ),
  orders ( order_number ),
  parcel_shipments ( tracking_number )
`;

export async function fetchLiveDelivery(deliveryId: string): Promise<LiveDeliveryView | null> {
  const { data, error } = await supabase
    .from('deliveries')
    .select(LIVE_SELECT)
    .eq('id', deliveryId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapLive(data as Record<string, unknown>);
}

export async function fetchLiveDeliveryByOrder(
  orderId: string
): Promise<LiveDeliveryView | null> {
  const { data, error } = await supabase
    .from('deliveries')
    .select(LIVE_SELECT)
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapLive(data as Record<string, unknown>);
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

/** Prépare coords pickup/delivery + distance/ETA sur une course */
export async function prepareDeliveryRoute(
  deliveryId: string,
  pickupCity: string,
  deliveryCity: string,
  vehicleType?: string | null
): Promise<{ distanceKm: number; etaMinutes: number; pickup: LatLng; dropoff: LatLng } | null> {
  const pickup = coordsForCity(pickupCity);
  const dropoff = coordsForCity(deliveryCity);
  if (!pickup || !dropoff) return null;

  const distanceKm = Math.round(haversineKm(pickup, dropoff) * 10) / 10;
  const etaMinutes = estimateEtaMinutes(distanceKm, vehicleType);

  const { error } = await supabase
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

  if (error) console.warn('prepareDeliveryRoute', error.message);
  return { distanceKm, etaMinutes, pickup, dropoff };
}

export function subscribeDeliveryLocation(
  deliveryId: string,
  onChange: (row: { current_lat: number | null; current_lng: number | null; location_updated_at: string | null; status: string }) => void
) {
  const channel = supabase
    .channel(`delivery-loc-${deliveryId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'deliveries',
        filter: `id=eq.${deliveryId}`,
      },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        onChange({
          current_lat: row.current_lat != null ? Number(row.current_lat) : null,
          current_lng: row.current_lng != null ? Number(row.current_lng) : null,
          location_updated_at: (row.location_updated_at as string) ?? null,
          status: String(row.status),
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
