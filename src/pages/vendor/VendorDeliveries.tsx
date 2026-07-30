import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Truck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getVendorIdForUser } from '../../services/vendor';
import {
  DELIVERY_STATUS_LABELS,
  fetchVendorDeliveries,
  type DeliveryView,
} from '../../services/vendor-deliveries';

export default function VendorDeliveriesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<DeliveryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const vId = user.vendor?.id || (await getVendorIdForUser(user.id));
        if (!vId) throw new Error('Boutique introuvable');
        setItems(await fetchVendorDeliveries(vId));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">Mes livraisons</h1>
      <p className="text-sm text-gray-500 mb-6">
        Courses où vous livrez vous-même (mode « Je livre moi-même ») — partage GPS et suivi client.
      </p>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-32 bg-white rounded-2xl border animate-pulse" />
      ) : items.length === 0 ? (
        <div className="bg-white border rounded-2xl p-10 text-center text-gray-500 text-sm">
          <Truck className="mx-auto mb-3 text-gray-300" size={36} />
          Aucune livraison vendeur en cours.
          <p className="mt-2 text-xs">
            Sur une commande en mode « Je livre moi-même », cliquez sur « Démarrer ma livraison ».
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((d) => (
            <Link
              key={d.id}
              to={`/vendeur/livraisons/${d.id}`}
              className="block bg-white border border-gray-100 rounded-2xl p-4 hover:border-[#FF6B00] transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-extrabold">{d.orderNumber || 'Commande'}</p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <MapPin size={12} /> {d.pickupCity} → {d.deliveryCity}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 truncate max-w-md">
                    {d.deliveryAddress}
                  </p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-50 text-[#FF6B00] shrink-0">
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
