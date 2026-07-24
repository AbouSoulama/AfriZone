import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Package,
  Plus,
  ShoppingBag,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatPrice } from '../../services/catalog';
import { fetchVendorStats, getVendorIdForUser, type VendorStats } from '../../services/vendor';
import {
  fetchVendorOrderStats,
  type VendorOrderStats,
} from '../../services/vendor-orders';

export default function VendorDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [orderStats, setOrderStats] = useState<VendorOrderStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const vendorId = user.vendor?.id || (await getVendorIdForUser(user.id));
        if (!vendorId) {
          setError('Boutique introuvable ou non approuvée.');
          return;
        }
        const [productStats, oStats] = await Promise.all([
          fetchVendorStats(vendorId),
          fetchVendorOrderStats(vendorId),
        ]);
        setStats(productStats);
        setOrderStats(oStats);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const cards = [
    {
      label: 'À préparer',
      value: orderStats?.toPrepare ?? 0,
      icon: ShoppingBag,
      color: '#FF6B00',
      to: '/vendeur/commandes',
    },
    {
      label: 'En livraison',
      value: orderStats?.inDelivery ?? 0,
      icon: Truck,
      color: '#2563EB',
      to: '/vendeur/commandes',
    },
    {
      label: 'Produits actifs',
      value: stats?.productsActive ?? 0,
      icon: Package,
      color: '#00A651',
      to: '/vendeur/produits',
    },
    {
      label: 'Stock faible (≤5)',
      value: stats?.lowStock ?? 0,
      icon: AlertTriangle,
      color: '#EF4444',
      to: '/vendeur/produits',
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1F2937]">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-1">
            Bienvenue, {user?.fullName.split(' ')[0]} — {user?.vendor?.shopName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/vendeur/commandes"
            className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-[#FF6B00] text-[#FF6B00] rounded-xl text-sm font-bold hover:bg-orange-50"
          >
            Voir les commandes
          </Link>
          <Link
            to="/vendeur/produits/nouveau"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF6B00] text-white rounded-xl text-sm font-bold hover:bg-[#E05E00]"
          >
            <Plus size={16} /> Ajouter un produit
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white rounded-2xl border animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <Link
                  key={c.label}
                  to={c.to}
                  className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-[#FF6B00] transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {c.label}
                    </span>
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${c.color}18`, color: c.color }}
                    >
                      <Icon size={18} />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-[#1F2937]">{c.value}</p>
                </Link>
              );
            })}
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-[#00A651] flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">CA commandes payées</p>
              <p className="text-xl font-extrabold text-[#1F2937]">
                {formatPrice(orderStats?.revenue ?? 0)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {orderStats?.total ?? 0} commande{(orderStats?.total ?? 0) > 1 ? 's' : ''} au total
                · {orderStats?.delivered ?? 0} livrée{(orderStats?.delivered ?? 0) > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <h2 className="font-extrabold text-[#1F2937] mb-2">Actions rapides</h2>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/vendeur/produits"
                className="px-4 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold hover:border-[#FF6B00]"
              >
                Gérer le stock
              </Link>
              {user?.vendor?.shopSlug && (
                <Link
                  to={`/boutique/${user.vendor.shopSlug}`}
                  className="px-4 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold hover:border-[#00A651]"
                >
                  Voir ma boutique publique
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
