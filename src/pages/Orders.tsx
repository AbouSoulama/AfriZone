import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../services/catalog';
import {
  fetchMyOrders,
  ORDER_STATUS_LABELS,
  type OrderView,
} from '../services/orders';

export default function OrdersPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchMyOrders(user.id)
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  if (!authLoading && !isAuthenticated) {
    return <Navigate to="/auth/login" replace state={{ from: '/commandes' }} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl md:text-3xl font-extrabold mb-6">Mes commandes</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="h-32 bg-white rounded-2xl border animate-pulse" />
        ) : orders.length === 0 ? (
          <div className="bg-white border rounded-2xl p-10 text-center">
            <p className="text-gray-600 mb-4">Aucune commande pour le moment.</p>
            <Link to="/catalogue" className="text-[#FF6B00] font-bold">
              Commencer vos achats
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <Link
                key={o.id}
                to={`/commandes/${o.id}`}
                className="block bg-white border border-gray-100 rounded-2xl p-5 hover:border-[#FF6B00] transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="font-mono font-bold text-[#FF6B00]">{o.orderNumber}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(o.createdAt).toLocaleString('fr-FR')} · {o.vendorName || 'Vendeur'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block text-xs font-bold px-2 py-1 rounded-full bg-orange-50 text-[#FF6B00]">
                      {ORDER_STATUS_LABELS[o.status]}
                    </span>
                    <p className="font-extrabold mt-1">{formatPrice(o.total)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
