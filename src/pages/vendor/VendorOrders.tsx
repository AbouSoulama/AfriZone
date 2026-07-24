import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatPrice } from '../../services/catalog';
import { getVendorIdForUser } from '../../services/vendor';
import {
  fetchVendorOrders,
  ORDER_STATUS_LABELS,
  type VendorOrderView,
} from '../../services/vendor-orders';
import type { OrderStatus } from '../../services/orders';

type FilterKey = 'all' | 'to_prepare' | 'shipped' | 'delivered' | 'cancelled';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'to_prepare', label: 'À préparer' },
  { key: 'shipped', label: 'En livraison' },
  { key: 'delivered', label: 'Livrées' },
  { key: 'cancelled', label: 'Annulées' },
];

function matchesFilter(order: VendorOrderView, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  if (filter === 'to_prepare') {
    return (
      order.status === 'pending' ||
      order.status === 'confirmed' ||
      order.status === 'processing'
    );
  }
  if (filter === 'shipped') return order.status === 'shipped';
  if (filter === 'delivered') return order.status === 'delivered';
  if (filter === 'cancelled') {
    return order.status === 'cancelled' || order.status === 'refunded';
  }
  return true;
}

function statusBadgeClass(status: OrderStatus): string {
  if (status === 'delivered') return 'bg-green-50 text-[#00A651]';
  if (status === 'cancelled' || status === 'refunded') return 'bg-red-50 text-red-600';
  if (status === 'shipped') return 'bg-blue-50 text-blue-700';
  return 'bg-orange-50 text-[#FF6B00]';
}

export default function VendorOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<VendorOrderView[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const vendorId = user.vendor?.id || (await getVendorIdForUser(user.id));
        if (!vendorId) {
          setError('Boutique introuvable.');
          return;
        }
        setOrders(await fetchVendorOrders(vendorId));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const filtered = useMemo(
    () => orders.filter((o) => matchesFilter(o, filter)),
    [orders, filter]
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[#1F2937]">Commandes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gérez les commandes reçues et mettez à jour leur statut.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto mb-5 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
              filter === f.key
                ? 'bg-[#FF6B00] text-white'
                : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-40 bg-white rounded-2xl border animate-pulse" />
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-2xl p-10 text-center text-gray-500">
          Aucune commande dans cette catégorie.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <Link
              key={o.id}
              to={`/vendeur/commandes/${o.id}`}
              className="block bg-white border border-gray-100 rounded-2xl p-5 hover:border-[#FF6B00] transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-mono font-bold text-[#FF6B00]">{o.orderNumber}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {new Date(o.createdAt).toLocaleString('fr-FR')}
                    {o.customerName ? ` · ${o.customerName}` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {o.items.length} article{o.items.length > 1 ? 's' : ''} · {o.shippingCity}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <span
                    className={`inline-block text-xs font-bold px-2 py-1 rounded-full ${statusBadgeClass(o.status)}`}
                  >
                    {ORDER_STATUS_LABELS[o.status]}
                  </span>
                  <p className="font-extrabold mt-1">{formatPrice(o.total)}</p>
                  <p className="text-xs text-gray-500">
                    {o.paymentStatus === 'paid' ? 'Payé' : 'Paiement en attente'}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
