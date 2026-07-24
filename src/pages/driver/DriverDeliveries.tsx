import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-6">Mes courses</h1>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
          {error}
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
                <span className="inline-block text-xs font-bold px-2 py-1 rounded-full bg-orange-50 text-[#FF6B00] w-fit">
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
