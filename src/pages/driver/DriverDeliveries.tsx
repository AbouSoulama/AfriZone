import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Route } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { coordsForCity, optimizeRouteOrder } from '../../lib/geo';
import {
  DELIVERY_STATUS_LABELS,
  fetchDriverDeliveries,
  getDriverForUser,
  type DeliveryView,
} from '../../services/drivers';

export default function DriverDeliveriesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<DeliveryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const driverId = user.driver?.id || (await getDriverForUser(user.id))?.id;
        if (!driverId) {
          setError('Profil livreur introuvable.');
          return;
        }
        setItems(await fetchDriverDeliveries(driverId));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const active = items.filter((d) =>
    ['assigned', 'accepted', 'picked_up', 'in_transit'].includes(d.status)
  );

  const optimized = useMemo(() => {
    const start = coordsForCity(user?.driver?.city || user?.city || 'Dakar');
    if (!start) return null;
    const stops = active
      .map((d) => {
        const point = coordsForCity(d.deliveryCity);
        if (!point) return null;
        return {
          id: d.id,
          label:
            (d.kind === 'order' ? d.orderNumber : d.parcelTracking) ||
            `${d.pickupCity} → ${d.deliveryCity}`,
          point,
        };
      })
      .filter(Boolean) as { id: string; label: string; point: { lat: number; lng: number } }[];

    if (stops.length < 2) return null;
    return optimizeRouteOrder(start, stops);
  }, [active, user]);

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">Mes courses</h1>
      <p className="text-sm text-gray-500 mb-6">Géolocalisation et ordre d’itinéraire optimisé</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
          {error}
        </div>
      )}

      {optimized && (
        <div className="bg-white border border-amber-200 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Route size={18} className="text-[#FF6B00]" />
            <h2 className="font-extrabold">Itinéraire optimisé</h2>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Ordre suggéré (plus proche voisin) · ~{optimized.totalKm} km au total
          </p>
          <ol className="space-y-2">
            {optimized.ordered.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-[#FF6B00] text-white text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <Link to={`/livreur/courses/${s.id}`} className="font-semibold hover:text-[#FF6B00]">
                  {s.label}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}

      {loading ? (
        <div className="h-32 bg-white rounded-2xl border animate-pulse" />
      ) : items.length === 0 ? (
        <div className="bg-white border rounded-2xl p-10 text-center text-gray-500">
          Aucune course assignée pour le moment.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((d) => (
            <Link
              key={d.id}
              to={`/livreur/courses/${d.id}`}
              className="block bg-white border border-gray-100 rounded-2xl p-5 hover:border-[#FF6B00] transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="font-mono font-bold text-[#FF6B00]">
                    {d.kind === 'order' ? d.orderNumber : d.parcelTracking}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {d.pickupCity} → {d.deliveryCity} ·{' '}
                    {d.kind === 'order' ? 'Commande' : 'Colis'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(d.createdAt).toLocaleString('fr-FR')}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-orange-50 text-[#FF6B00] w-fit">
                  {DELIVERY_STATUS_LABELS[d.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
