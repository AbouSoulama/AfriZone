import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatPrice } from '../../services/catalog';
import { getVendorIdForUser } from '../../services/vendor';
import {
  cancelVendorOrder,
  canVendorCancel,
  fetchVendorOrderById,
  nextVendorStatus,
  ORDER_STATUS_LABELS,
  ORDER_TIMELINE,
  updateVendorOrderStatus,
  type VendorOrderView,
} from '../../services/vendor-orders';
import type { OrderStatus } from '../../services/orders';
import { PAYMENT_METHOD_LABELS } from '../../services/orders';

const NEXT_ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  confirmed: 'Passer en préparation',
  processing: 'Marquer en livraison',
  shipped: 'Marquer comme livrée',
  pending: 'Confirmer la commande',
};

function timelineIndex(status: OrderStatus): number {
  if (status === 'cancelled' || status === 'refunded') return -1;
  return ORDER_TIMELINE.indexOf(status);
}

export default function VendorOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [order, setOrder] = useState<VendorOrderView | null>(null);
  const [tracking, setTracking] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (vId: string, orderId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVendorOrderById(vId, orderId);
      setOrder(data);
      setTracking(data?.trackingNumber || '');
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

  const currentIdx = order ? timelineIndex(order.status) : -1;
  const next = order ? nextVendorStatus(order.status) : null;

  const onAdvance = async () => {
    if (!vendorId || !order || !next) return;
    if (next === 'shipped' && !tracking.trim() && !order.trackingNumber) {
      setError('Indiquez un numéro de suivi avant de passer en livraison.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateVendorOrderStatus(vendorId, order.id, next, tracking);
      await load(vendorId, order.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    if (!vendorId || !order) return;
    if (!confirm('Annuler cette commande ?')) return;
    setBusy(true);
    setError(null);
    try {
      await cancelVendorOrder(vendorId, order.id);
      await load(vendorId, order.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Link
        to="/vendeur/commandes"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#FF6B00] mb-6"
      >
        <ArrowLeft size={16} /> Retour aux commandes
      </Link>

      {loading && <div className="h-40 bg-white rounded-2xl border animate-pulse" />}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
          {error}
        </div>
      )}

      {!loading && !order && !error && (
        <div className="bg-white border rounded-2xl p-8 text-center text-gray-500">
          Commande introuvable.
        </div>
      )}

      {order && (
        <div className="space-y-6 max-w-3xl">
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
              <div>
                <p className="font-mono font-bold text-[#FF6B00] text-lg">{order.orderNumber}</p>
                <p className="text-sm text-gray-500">
                  {new Date(order.createdAt).toLocaleString('fr-FR')}
                </p>
              </div>
              <span className="inline-block text-xs font-bold px-3 py-1 rounded-full bg-orange-50 text-[#FF6B00]">
                {ORDER_STATUS_LABELS[order.status]}
              </span>
            </div>

            {order.status !== 'cancelled' && order.status !== 'refunded' && (
              <div className="flex items-center justify-between gap-1 overflow-x-auto py-4">
                {ORDER_TIMELINE.map((step, idx) => {
                  const done = currentIdx >= idx;
                  return (
                    <div key={step} className="flex-1 min-w-[70px] text-center">
                      <div
                        className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center mb-1 ${
                          done ? 'bg-[#00A651] text-white' : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        {done ? <Check size={14} /> : idx + 1}
                      </div>
                      <p className="text-[10px] font-semibold text-gray-600">
                        {ORDER_STATUS_LABELS[step]}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 text-sm space-y-2">
            <h2 className="font-extrabold mb-2">Client & livraison</h2>
            <p>
              <span className="text-gray-500">Client :</span>{' '}
              {order.customerName || '—'}
            </p>
            <p>
              <span className="text-gray-500">Tél. client :</span>{' '}
              {order.customerPhone || order.shippingPhone}
            </p>
            <p>
              <span className="text-gray-500">Adresse :</span> {order.shippingAddress},{' '}
              {order.shippingCity}
            </p>
            <p>
              <span className="text-gray-500">Tél. livraison :</span> {order.shippingPhone}
            </p>
            <p>
              <span className="text-gray-500">Paiement :</span>{' '}
              {order.paymentMethod
                ? PAYMENT_METHOD_LABELS[order.paymentMethod] || 'Mobile Money'
                : '—'}{' '}
              ·{' '}
              <strong>{order.paymentStatus === 'paid' ? 'Payé' : 'En attente'}</strong>
            </p>
            {order.notes && (
              <p>
                <span className="text-gray-500">Notes :</span> {order.notes}
              </p>
            )}
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <h2 className="font-extrabold mb-3">Articles</h2>
            <ul className="space-y-3">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3">
                  <img
                    src={
                      item.productImage ||
                      'https://images.unsplash.com/photo-1560393464-5c69a73c5770?w=80&h=80&fit=crop'
                    }
                    alt=""
                    className="w-14 h-14 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{item.productName}</p>
                    <p className="text-xs text-gray-500">
                      {item.quantity} × {formatPrice(item.price)}
                    </p>
                  </div>
                  <p className="font-bold text-sm">{formatPrice(item.total)}</p>
                </li>
              ))}
            </ul>
            <div className="border-t mt-4 pt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Sous-total</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Livraison</span>
                <span>{formatPrice(order.shippingCost)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-base">
                <span>Total</span>
                <span className="text-[#FF6B00]">{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>

          {next && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
              <h2 className="font-extrabold">Actions</h2>
              {(next === 'shipped' || order.status === 'processing' || order.trackingNumber) && (
                <div>
                  <label className="block text-sm font-bold mb-2">
                    Numéro de suivi {next === 'shipped' ? '*' : '(optionnel)'}
                  </label>
                  <input
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                    placeholder="AZ-TRACK-..."
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={onAdvance}
                disabled={busy}
                className="w-full py-3 bg-[#00A651] hover:bg-[#008A43] disabled:opacity-50 text-white rounded-xl font-bold"
              >
                {busy
                  ? 'Mise à jour...'
                  : NEXT_ACTION_LABEL[order.status] ||
                    `Passer à : ${ORDER_STATUS_LABELS[next]}`}
              </button>
            </div>
          )}

          {canVendorCancel(order.status) && (
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="w-full py-3 border-2 border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 disabled:opacity-50"
            >
              Annuler la commande
            </button>
          )}
        </div>
      )}
    </div>
  );
}
