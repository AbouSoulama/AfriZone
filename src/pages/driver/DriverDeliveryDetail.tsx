import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, MapPin, Navigation } from 'lucide-react';
import LiveTrackingMap from '../../components/geo/LiveTrackingMap';
import { useAuth } from '../../context/AuthContext';
import {
  coordsForCity,
  googleMapsDirectionsUrl,
  type LatLng,
} from '../../lib/geo';
import {
  DELIVERY_STATUS_LABELS,
  DELIVERY_TIMELINE,
  fetchDriverDeliveryById,
  getDriverForUser,
  nextDeliveryStatus,
  updateDeliveryStatusByDriver,
  type DeliveryJobStatus,
  type DeliveryView,
} from '../../services/drivers';
import {
  prepareDeliveryRoute,
  pushDeliveryLocation,
} from '../../services/geolocation';

const NEXT_LABEL: Partial<Record<DeliveryJobStatus, string>> = {
  assigned: 'Accepter la course',
  accepted: 'Marquer collectée',
  picked_up: 'En route',
  in_transit: 'Marquer livrée',
};

export default function DriverDeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<DeliveryView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [lastPos, setLastPos] = useState<LatLng | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ km: number; eta: number } | null>(null);
  const watchRef = useRef<number | null>(null);

  const load = async (dId: string, deliveryId: string) => {
    setLoading(true);
    try {
      const d = await fetchDriverDeliveryById(dId, deliveryId);
      setDelivery(d);
      setError(null);
      if (d) {
        const prepared = await prepareDeliveryRoute(
          d.id,
          d.pickupCity,
          d.deliveryCity,
          user?.driver?.vehicleType
        );
        if (prepared) setRouteInfo({ km: prepared.distanceKm, eta: prepared.etaMinutes });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      try {
        const dId = user.driver?.id || (await getDriverForUser(user.id))?.id;
        if (!dId) {
          setError('Profil livreur introuvable.');
          setLoading(false);
          return;
        }
        setDriverId(dId);
        await load(dId, id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
        setLoading(false);
      }
    })();
  }, [user, id]);

  useEffect(() => {
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  const stopSharing = () => {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setSharing(false);
  };

  const startSharing = () => {
    if (!delivery || !navigator.geolocation) {
      setError('Géolocalisation non disponible sur cet appareil.');
      return;
    }
    setError(null);
    setSharing(true);
    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLastPos(point);
        try {
          await pushDeliveryLocation(delivery.id, point.lat, point.lng);
        } catch (e) {
          console.warn(e);
        }
      },
      (err) => {
        setError(err.message || 'Impossible d’obtenir la position GPS.');
        stopSharing();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  };

  const currentIdx = delivery ? DELIVERY_TIMELINE.indexOf(delivery.status) : -1;
  const next = delivery ? nextDeliveryStatus(delivery.status) : null;
  const canShare = delivery
    ? ['accepted', 'picked_up', 'in_transit'].includes(delivery.status)
    : false;

  const pickup = delivery ? coordsForCity(delivery.pickupCity) : null;
  const dropoff = delivery ? coordsForCity(delivery.deliveryCity) : null;

  const onAdvance = async () => {
    if (!driverId || !delivery || !next) return;
    setBusy(true);
    try {
      await updateDeliveryStatusByDriver(driverId, delivery.id, next);
      if (next === 'accepted' || next === 'picked_up' || next === 'in_transit') {
        if (!sharing) startSharing();
      }
      if (next === 'delivered') stopSharing();
      await load(driverId, delivery.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const onRefuse = async () => {
    if (!driverId || !delivery) return;
    if (!confirm('Refuser cette course ?')) return;
    setBusy(true);
    try {
      stopSharing();
      await updateDeliveryStatusByDriver(driverId, delivery.id, 'refused');
      await load(driverId, delivery.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Link
        to="/livreur/courses"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#FF6B00] mb-6"
      >
        <ArrowLeft size={16} /> Mes courses
      </Link>

      {loading && <div className="h-40 bg-white rounded-2xl border animate-pulse" />}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
          {error}
        </div>
      )}

      {delivery && (
        <div className="space-y-6 max-w-3xl">
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
              <div>
                <p className="font-mono font-bold text-[#FF6B00] text-lg">
                  {delivery.kind === 'order' ? delivery.orderNumber : delivery.parcelTracking}
                </p>
                <p className="text-sm text-gray-500">
                  {delivery.kind === 'order' ? 'Commande marketplace' : 'Envoi de colis'}
                </p>
              </div>
              <span className="inline-block text-xs font-bold px-3 py-1 rounded-full bg-orange-50 text-[#FF6B00]">
                {DELIVERY_STATUS_LABELS[delivery.status]}
              </span>
            </div>

            {!['refused', 'cancelled'].includes(delivery.status) && (
              <div className="flex items-center justify-between gap-1 overflow-x-auto py-4">
                {DELIVERY_TIMELINE.map((step, idx) => {
                  const done = currentIdx >= idx;
                  return (
                    <div key={step} className="flex-1 min-w-[64px] text-center">
                      <div
                        className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center mb-1 ${
                          done ? 'bg-[#00A651] text-white' : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        {done ? <Check size={14} /> : idx + 1}
                      </div>
                      <p className="text-[9px] font-semibold text-gray-600">
                        {DELIVERY_STATUS_LABELS[step]}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 text-sm space-y-2">
            <h2 className="font-extrabold mb-2">Itinéraire</h2>
            <p>
              <span className="text-gray-500">Enlèvement :</span> {delivery.pickupAddress},{' '}
              {delivery.pickupCity}
            </p>
            <p>
              <span className="text-gray-500">Livraison :</span> {delivery.deliveryAddress},{' '}
              {delivery.deliveryCity}
            </p>
            {routeInfo && (
              <p className="text-[#FF6B00] font-bold">
                ~{routeInfo.km} km · ETA ~{routeInfo.eta} min
              </p>
            )}
            {pickup && dropoff && (
              <a
                href={googleMapsDirectionsUrl(pickup, dropoff)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF6B00] pt-1"
              >
                <Navigation size={14} /> Ouvrir l’itinéraire optimisé (Maps)
              </a>
            )}
          </div>

          {canShare && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {!sharing ? (
                  <button
                    type="button"
                    onClick={startSharing}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF6B00] text-white rounded-xl text-sm font-bold"
                  >
                    <MapPin size={16} /> Partager ma position GPS
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopSharing}
                    className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-red-200 text-red-600 rounded-xl text-sm font-bold"
                  >
                    Arrêter le partage
                  </button>
                )}
                {sharing && (
                  <span className="inline-flex items-center text-xs font-bold text-[#00A651]">
                    ● En direct
                  </span>
                )}
              </div>
              <LiveTrackingMap
                driver={lastPos}
                pickup={pickup}
                dropoff={dropoff}
                distanceKm={routeInfo?.km}
                etaMinutes={routeInfo?.eta}
              />
            </div>
          )}

          {next && (
            <button
              type="button"
              onClick={onAdvance}
              disabled={busy}
              className="w-full py-3 bg-[#00A651] hover:bg-[#008A43] disabled:opacity-50 text-white rounded-xl font-bold"
            >
              {busy ? 'Mise à jour...' : NEXT_LABEL[delivery.status] || DELIVERY_STATUS_LABELS[next]}
            </button>
          )}

          {delivery.status === 'assigned' && (
            <button
              type="button"
              onClick={onRefuse}
              disabled={busy}
              className="w-full py-3 border-2 border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 disabled:opacity-50"
            >
              Refuser la course
            </button>
          )}
        </div>
      )}
    </div>
  );
}
