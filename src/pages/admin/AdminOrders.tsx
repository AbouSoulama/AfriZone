import { useEffect, useState } from 'react';
import { formatPrice } from '../../services/catalog';
import {
  adminUpdateOrderStatus,
  fetchAdminOrders,
  ORDER_STATUS_LABELS,
} from '../../services/admin-dashboard';
import type { OrderStatus, OrderView } from '../../services/orders';

const FILTERS: Array<OrderStatus | 'all'> = [
  'all',
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed',
  confirmed: 'processing',
  processing: 'shipped',
  shipped: 'delivered',
};

export default function AdminOrdersPage() {
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await fetchAdminOrders(status));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  const advance = async (order: OrderView) => {
    const next = NEXT[order.status];
    if (!next) return;
    setBusyId(order.id);
    try {
      await adminUpdateOrderStatus(order.id, next);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (order: OrderView) => {
    if (!confirm(`Annuler la commande ${order.orderNumber} ?`)) return;
    setBusyId(order.id);
    try {
      await adminUpdateOrderStatus(order.id, 'cancelled');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#1F2937]">Commandes marketplace</h1>
        <p className="text-sm text-gray-500 mt-1">Suivi et intervention admin sur les commandes</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatus(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold ${
              status === f ? 'bg-[#FF6B00] text-white' : 'bg-white border text-gray-600'
            }`}
          >
            {f === 'all' ? 'Toutes' : ORDER_STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-2xl border animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white border rounded-2xl p-8 text-center text-gray-500">
          Aucune commande pour ce filtre.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const next = NEXT[o.status];
            return (
              <div
                key={o.id}
                className="bg-white border border-gray-100 rounded-2xl p-4 md:p-5"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono font-bold text-[#FF6B00]">{o.orderNumber}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {o.vendorName || 'Vendeur'} · {o.shippingCity}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(o.createdAt).toLocaleString('fr-FR')} · {o.items.length} article(s)
                    </p>
                    <p className="text-sm font-extrabold mt-2">{formatPrice(o.total)}</p>
                  </div>
                  <div className="flex flex-col items-start md:items-end gap-2">
                    <span className="inline-block text-xs font-bold px-3 py-1 rounded-full bg-orange-50 text-[#FF6B00]">
                      {ORDER_STATUS_LABELS[o.status]}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Paiement :{' '}
                      {o.paymentStatus === 'paid'
                        ? 'Payé'
                        : o.paymentStatus === 'failed'
                          ? 'Échoué'
                          : 'En attente'}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {next && (
                        <button
                          type="button"
                          disabled={busyId === o.id}
                          onClick={() => advance(o)}
                          className="px-3 py-1.5 bg-[#00A651] text-white rounded-xl text-xs font-bold disabled:opacity-50"
                        >
                          → {ORDER_STATUS_LABELS[next]}
                        </button>
                      )}
                      {o.status !== 'cancelled' &&
                        o.status !== 'delivered' &&
                        o.status !== 'refunded' && (
                          <button
                            type="button"
                            disabled={busyId === o.id}
                            onClick={() => cancel(o)}
                            className="px-3 py-1.5 border border-red-200 text-red-600 rounded-xl text-xs font-bold disabled:opacity-50"
                          >
                            Annuler
                          </button>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
