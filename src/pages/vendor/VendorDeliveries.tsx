import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bike, MapPin, Truck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getVendorIdForUser } from '../../services/vendor';
import {
  DELIVERY_STATUS_LABELS,
  fetchVendorDeliveries,
  type VendorDeliveryView,
} from '../../services/vendor-deliveries';
import { supabase } from '../../lib/supabase';

export default function VendorDeliveriesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<VendorDeliveryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);

  const load = async (vId: string) => {
    setItems(await fetchVendorDeliveries(vId));
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const vId = user.vendor?.id || (await getVendorIdForUser(user.id));
        if (!vId) throw new Error('Boutique introuvable');
        if (cancelled) return;
        setVendorId(vId);
        await load(vId);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Temps réel : toute mise à jour de course liée au vendeur
  useEffect(() => {
    if (!vendorId) return;
    const channel = supabase
      .channel(`vendor-deliveries-${vendorId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliveries' },
        () => {
          void load(vendorId).catch(() => undefined);
        }
      )
      .subscribe();
    const poll = window.setInterval(() => {
      void load(vendorId).catch(() => undefined);
    }, 15000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(poll);
    };
  }, [vendorId]);

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">Mes livraisons</h1>
      <p className="text-sm text-gray-500 mb-6">
        Suivi en direct des courses AfriZone (livreur) et de vos livraisons personnelles.
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
          Aucune livraison pour le moment.
          <p className="mt-2 text-xs">
            Quand un admin assigne un livreur, ou quand vous démarrez « Je livre moi-même », la
            course apparaît ici avec son statut en temps réel.
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
                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {d.courierKind === 'vendor' ? (
                      <>
                        <Truck size={11} /> Vous livrez
                      </>
                    ) : (
                      <>
                        <Bike size={11} /> Livreur AfriZone
                        {d.driverCode ? ` · ${d.driverCode}` : ''}
                      </>
                    )}
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
