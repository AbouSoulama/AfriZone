import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LiveTrackingMap from '../components/geo/LiveTrackingMap';
import { useAuth } from '../context/AuthContext';
import {
  DELIVERY_STATUS_LABELS,
  type DeliveryJobStatus,
} from '../services/drivers';
import {
  fetchLiveDelivery,
  subscribeDeliveryLocation,
  type LiveDeliveryView,
} from '../services/geolocation';
import { estimateEtaMinutes, haversineKm, type LatLng } from '../lib/geo';

export default function DeliveryTrackPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [delivery, setDelivery] = useState<LiveDeliveryView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await fetchLiveDelivery(id);
        if (!cancelled) {
          setDelivery(d);
          if (!d) setError('Course introuvable ou non autorisée.');
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !delivery) return;
    return subscribeDeliveryLocation(id, (row) => {
      setDelivery((prev) =>
        prev
          ? {
              ...prev,
              currentLat: row.current_lat,
              currentLng: row.current_lng,
              locationUpdatedAt: row.location_updated_at,
              status: row.status as DeliveryJobStatus,
            }
          : prev
      );
    });
  }, [id, delivery?.id]);

  if (!authLoading && !isAuthenticated) {
    return <Navigate to="/auth/login" replace state={{ from: `/suivi-livraison/${id}` }} />;
  }

  const driver: LatLng | null =
    delivery?.currentLat != null && delivery?.currentLng != null
      ? { lat: delivery.currentLat, lng: delivery.currentLng }
      : null;
  const pickup: LatLng | null =
    delivery?.pickupLat != null && delivery?.pickupLng != null
      ? { lat: delivery.pickupLat, lng: delivery.pickupLng }
      : null;
  const dropoff: LatLng | null =
    delivery?.deliveryLat != null && delivery?.deliveryLng != null
      ? { lat: delivery.deliveryLat, lng: delivery.deliveryLng }
      : null;

  let liveEta = delivery?.routeEtaMinutes ?? null;
  let liveDist = delivery?.routeDistanceKm ?? null;
  if (driver && dropoff) {
    liveDist = Math.round(haversineKm(driver, dropoff) * 10) / 10;
    liveEta = estimateEtaMinutes(liveDist, delivery?.vehicleType);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link
          to="/commandes"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#FF6B00] mb-6"
        >
          <ArrowLeft size={16} /> Retour
        </Link>

        <h1 className="text-2xl font-extrabold mb-2">Suivi livreur</h1>
        <p className="text-sm text-gray-500 mb-6">Position en temps réel et itinéraire estimé</p>

        {loading && <div className="h-64 bg-white rounded-2xl border animate-pulse" />}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {delivery && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="font-mono font-bold text-[#FF6B00]">
                  {delivery.orderNumber || delivery.parcelTracking || delivery.id.slice(0, 8)}
                </p>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-orange-50 text-[#FF6B00]">
                  {DELIVERY_STATUS_LABELS[delivery.status]}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                {delivery.pickupCity} → {delivery.deliveryCity}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Livreur {delivery.driverCode || '—'} · {delivery.pickupAddress} →{' '}
                {delivery.deliveryAddress}
              </p>
            </div>

            <LiveTrackingMap
              driver={driver}
              pickup={pickup}
              dropoff={dropoff}
              distanceKm={liveDist}
              etaMinutes={liveEta}
              updatedAt={delivery.locationUpdatedAt}
            />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
