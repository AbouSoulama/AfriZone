import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bike, Check, MapPin, Navigation, Truck } from 'lucide-react';
import LiveTrackingMap from '../../components/geo/LiveTrackingMap';
import { useAuth } from '../../context/AuthContext';
import { coordsForCity, googleMapsDirectionsUrl, type LatLng } from '../../lib/geo';
import { getVendorIdForUser } from '../../services/vendor';
import {
  DELIVERY_STATUS_LABELS,
  DELIVERY_TIMELINE,
  fetchVendorDeliveryById,
  nextDeliveryStatus,
  subscribeVendorDelivery,
  updateVendorDeliveryStatus,
  type DeliveryJobStatus,
  type VendorDeliveryView,
} from '../../services/vendor-deliveries';
import { prepareDeliveryRoute, pushDeliveryLocation } from '../../services/geolocation';

const NEXT_LABEL: Partial<Record<DeliveryJobStatus, string>> = {
  assigned: 'Accepter',
  accepted: 'Marquer collectée',
  picked_up: 'En route vers le client',
  in_transit: 'Marquer livrée',
};

export default function VendorDeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<VendorDeliveryView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [lastPos, setLastPos] = useState<LatLng | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ km: number; eta: number } | null>(null);
  const watchRef = useRef<number | null>(null);

  const load = async (vId: string, deliveryId: string) => {
    setLoading(true);
    try {
      const d = await fetchVendorDeliveryById(vId, deliveryId);
      setDelivery(d);
      setError(null);
      if (d?.currentLat != null && d.currentLng != null) {
        setLastPos({ lat: d.currentLat, lng: d.currentLng });
      }
      if (d && d.courierKind === 'vendor') {
        const prepared = await prepareDeliveryRoute(d.id, d.pickupCity, d.deliveryCity, 'voiture');
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
        const vId = user.vendor?.id || (await getVendorIdForUser(user.id));
        if (!vId) {
          setError('Boutique introuvable.');
          setLoading(false);
          return;
        }
        setVendorId(vId);
        await load(vId, id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
        setLoading(false);
      }
    })();
  }, [user, id]);

  // Temps réel statut + GPS (livreur AfriZone ou auto-livraison)
  useEffect(() => {
    if (!delivery?.id) return;
    return subscribeVendorDelivery(delivery.id, (patch) => {
      setDelivery((prev) =>
        prev
          ? {
              ...prev,
              status: patch.status as DeliveryJobStatus,
              currentLat: patch.current_lat,
              currentLng: patch.current_lng,
              locationUpdatedAt: patch.location_updated_at,
            }
          : prev
      );
      if (patch.current_lat != null && patch.current_lng != null) {
        setLastPos({ lat: patch.current_lat, lng: patch.current_lng });
      }
    });
  }, [delivery?.id]);

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

  const onAdvance = async () => {
    if (!delivery || !vendorId || delivery.courierKind !== 'vendor') return;
    const next = nextDeliveryStatus(delivery.status);
    if (!next) return;
    setBusy(true);
    setError(null);
    try {
      await updateVendorDeliveryStatus(delivery.id, next);
      if (next === 'delivered') stopSharing();
      await load(vendorId, delivery.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const isSelf = delivery?.courierKind === 'vendor';
  const next = delivery && isSelf ? nextDeliveryStatus(delivery.status) : null;
  const idx = delivery ? DELIVERY_TIMELINE.indexOf(delivery.status) : -1;
  const dropoff =
    delivery?.deliveryLat != null && delivery.deliveryLng != null
      ? { lat: delivery.deliveryLat, lng: delivery.deliveryLng }
      : delivery
        ? coordsForCity(delivery.deliveryCity)
        : null;
  const mapsUrl =
    lastPos && dropoff
      ? googleMapsDirectionsUrl(lastPos, dropoff)
      : dropoff
        ? `https://www.google.com/maps/search/?api=1&query=${dropoff.lat},${dropoff.lng}`
        : null;

  return (
    <div>
      <Link
        to="/vendeur/livraisons"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#FF6B00] mb-6"
      >
        <ArrowLeft size={16} /> Mes livraisons
      </Link>

      {loading && <div className="h-40 bg-white rounded-2xl border animate-pulse" />}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      {delivery && (
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-4">
            <div className="bg-white border rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs font-bold text-[#FF6B00] uppercase inline-flex items-center gap-1">
                    {isSelf ? (
                      <>
                        <Truck size={12} /> Vous livrez
                      </>
                    ) : (
                      <>
                        <Bike size={12} /> Livreur AfriZone
                        {delivery.driverCode ? ` · ${delivery.driverCode}` : ''}
                      </>
                    )}
                  </p>
                  <h1 className="text-xl font-extrabold">{delivery.orderNumber}</h1>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-50 text-[#FF6B00]">
                  {DELIVERY_STATUS_LABELS[delivery.status]}
                </span>
              </div>

              <div className="flex gap-1 mb-6">
                {DELIVERY_TIMELINE.map((s, i) => (
                  <div
                    key={s}
                    className={`h-1.5 flex-1 rounded-full ${
                      idx >= i ? 'bg-[#FF6B00]' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex gap-2">
                  <MapPin size={16} className="text-[#00A651] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-xs text-gray-400 uppercase">Retrait</p>
                    <p>
                      {delivery.pickupAddress}, {delivery.pickupCity}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Navigation size={16} className="text-[#FF6B00] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-xs text-gray-400 uppercase">Livraison client</p>
                    <p>
                      {delivery.deliveryAddress}, {delivery.deliveryCity}
                    </p>
                    {delivery.recipientName && (
                      <p className="text-gray-500 text-xs mt-1">
                        {delivery.recipientName} · {delivery.recipientPhone}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {delivery.orderId && (
                <Link
                  to={`/vendeur/commandes/${delivery.orderId}`}
                  className="inline-block mt-4 text-sm font-semibold text-[#FF6B00]"
                >
                  Voir la commande →
                </Link>
              )}
            </div>

            <LiveTrackingMap
              driver={lastPos}
              dropoff={dropoff}
              distanceKm={routeInfo?.km}
              etaMinutes={routeInfo?.eta}
              updatedAt={delivery.locationUpdatedAt}
            />
          </div>

          <aside className="space-y-4">
            <div className="bg-white border rounded-2xl p-5 space-y-3">
              <h2 className="font-extrabold">Suivi GPS</h2>
              {isSelf ? (
                <>
                  <p className="text-xs text-gray-500">
                    Partagez votre position pour que le client suive la livraison en direct.
                  </p>
                  {!sharing ? (
                    <button
                      type="button"
                      onClick={startSharing}
                      disabled={delivery.status === 'delivered'}
                      className="w-full py-3 bg-[#FF6B00] text-white rounded-xl font-bold disabled:bg-gray-300"
                    >
                      Partager ma position
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopSharing}
                      className="w-full py-3 border-2 border-red-200 text-red-600 rounded-xl font-bold"
                    >
                      Arrêter le GPS
                    </button>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-500 leading-relaxed">
                  Le livreur AfriZone met à jour le statut et le GPS depuis l’application mobile.
                  Cette page se rafraîchit automatiquement.
                </p>
              )}
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full text-center py-2.5 border-2 rounded-xl text-sm font-semibold"
                >
                  Ouvrir dans Google Maps
                </a>
              )}
              <Link
                to={`/suivi-livraison/${delivery.id}`}
                className="block w-full text-center py-2.5 text-sm font-semibold text-[#FF6B00]"
              >
                Lien suivi client
              </Link>
            </div>

            {next && (
              <button
                type="button"
                onClick={onAdvance}
                disabled={busy}
                className="w-full py-3.5 bg-[#00A651] hover:bg-[#008A43] disabled:bg-gray-300 text-white rounded-xl font-bold inline-flex items-center justify-center gap-2"
              >
                <Check size={18} />
                {busy ? '...' : NEXT_LABEL[delivery.status] || 'Suivant'}
              </button>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
