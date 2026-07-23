import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../services/catalog';
import {
  cancelOrder,
  fetchOrderById,
  ORDER_STATUS_LABELS,
  ORDER_TIMELINE,
  PAYMENT_METHOD_LABELS,
  type OrderStatus,
  type OrderView,
  type PaymentMethod,
} from '../services/orders';

function timelineIndex(status: OrderStatus): number {
  if (status === 'cancelled' || status === 'refunded') return -1;
  return ORDER_TIMELINE.indexOf(status);
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user || !id) return;
    setLoading(true);
    try {
      setOrder(await fetchOrderById(user.id, id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user, id]);

  if (!authLoading && !isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  const currentIdx = order ? timelineIndex(order.status) : -1;

  const onCancel = async () => {
    if (!user || !order) return;
    if (!confirm('Annuler cette commande ?')) return;
    setBusy(true);
    try {
      await cancelOrder(user.id, order.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link
          to="/commandes"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#FF6B00] mb-6"
        >
          <ArrowLeft size={16} /> Mes commandes
        </Link>

        {loading && <div className="h-40 bg-white rounded-2xl border animate-pulse" />}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
            {error}
          </div>
        )}

        {!loading && !order && (
          <div className="bg-white border rounded-2xl p-8 text-center text-gray-500">
            Commande introuvable.
          </div>
        )}

        {order && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                <div>
                  <p className="font-mono font-bold text-[#FF6B00] text-lg">{order.orderNumber}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleString('fr-FR')}
                  </p>
                  <p className="text-sm mt-1">
                    Vendeur : <strong>{order.vendorName || '—'}</strong>
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

            <div className="bg-white border border-gray-100 rounded-2xl p-6 text-sm space-y-2">
              <h2 className="font-extrabold mb-2">Livraison & paiement</h2>
              <p>
                <span className="text-gray-500">Adresse :</span> {order.shippingAddress},{' '}
                {order.shippingCity}
              </p>
              <p>
                <span className="text-gray-500">Téléphone :</span> {order.shippingPhone}
              </p>
              <p>
                <span className="text-gray-500">Paiement :</span>{' '}
                {order.paymentMethod && order.paymentMethod in PAYMENT_METHOD_LABELS
                  ? PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod]
                  : order.paymentMethod || '—'}{' '}
                ·{' '}
                <span className="font-semibold">
                  {order.paymentStatus === 'paid'
                    ? 'Payé'
                    : order.paymentStatus === 'failed'
                      ? 'Échoué'
                      : 'En attente'}
                </span>
              </p>
              {order.notes && (
                <p>
                  <span className="text-gray-500">Notes :</span> {order.notes}
                </p>
              )}
              {order.trackingNumber && (
                <p>
                  <span className="text-gray-500">Suivi :</span> {order.trackingNumber}
                </p>
              )}
            </div>

            {(order.status === 'pending' ||
              (order.status === 'confirmed' && order.paymentStatus !== 'paid')) && (
              <button
                onClick={onCancel}
                disabled={busy}
                className="w-full py-3 border-2 border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 disabled:opacity-50"
              >
                Annuler la commande
              </button>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
