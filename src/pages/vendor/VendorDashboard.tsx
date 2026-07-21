import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Package, Plus, ShoppingBag, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchVendorStats, getVendorIdForUser, type VendorStats } from '../../services/vendor';

export default function VendorDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<VendorStats | null>(null);
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
        setStats(await fetchVendorStats(vendorId));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const cards = [
    {
      label: 'Produits actifs',
      value: stats?.productsActive ?? 0,
      icon: Package,
      color: '#FF6B00',
    },
    {
      label: 'Total produits',
      value: stats?.productsTotal ?? 0,
      icon: ShoppingBag,
      color: '#00A651',
    },
    {
      label: 'Stock faible (≤5)',
      value: stats?.lowStock ?? 0,
      icon: AlertTriangle,
      color: '#EF4444',
    },
    {
      label: 'Unités vendues',
      value: stats?.totalSold ?? 0,
      icon: TrendingUp,
      color: '#1F2937',
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
        <Link
          to="/vendeur/produits/nouveau"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF6B00] text-white rounded-xl text-sm font-bold hover:bg-[#E05E00]"
        >
          <Plus size={16} /> Ajouter un produit
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-2xl border animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="bg-white border border-gray-100 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-500">{c.label}</p>
                  <Icon size={18} style={{ color: c.color }} />
                </div>
                <p className="text-3xl font-extrabold text-[#1F2937]">{c.value}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <h2 className="font-extrabold text-[#1F2937] mb-2">Actions rapides</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/vendeur/produits"
            className="px-4 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold hover:border-[#FF6B00]"
          >
            Gérer le stock
          </Link>
          <Link
            to={`/boutique/${user?.vendor?.shopSlug}`}
            className="px-4 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold hover:border-[#00A651]"
          >
            Voir ma boutique publique
          </Link>
        </div>
      </div>
    </div>
  );
}
