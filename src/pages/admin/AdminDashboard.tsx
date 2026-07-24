import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bike,
  MessageSquare,
  Package,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
} from 'lucide-react';
import { formatPrice } from '../../services/catalog';
import {
  fetchAdminDashboardStats,
  type AdminDashboardStats,
} from '../../services/admin-dashboard';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setStats(await fetchAdminDashboardStats());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cards = [
    {
      label: 'CA encaissé',
      value: formatPrice(stats?.revenuePaid ?? 0),
      icon: TrendingUp,
      color: '#FF6B00',
      to: '/admin/commandes',
    },
    {
      label: 'Commandes ouvertes',
      value: String(stats?.ordersOpen ?? 0),
      icon: ShoppingBag,
      color: '#2563EB',
      to: '/admin/commandes',
    },
    {
      label: 'Utilisateurs',
      value: String(stats?.usersTotal ?? 0),
      icon: Users,
      color: '#7C3AED',
      to: '/admin',
    },
    {
      label: 'Vendeurs à valider',
      value: String(stats?.vendorsPending ?? 0),
      icon: Store,
      color: '#00A651',
      to: '/admin/vendeurs',
    },
    {
      label: 'Livreurs à valider',
      value: String(stats?.driversPending ?? 0),
      icon: Bike,
      color: '#EA580C',
      to: '/admin/livreurs',
    },
    {
      label: 'Colis actifs',
      value: String(stats?.parcelsActive ?? 0),
      icon: Package,
      color: '#0891B2',
      to: '/admin/colis',
    },
    {
      label: 'Produits actifs',
      value: String(stats?.productsActive ?? 0),
      icon: Package,
      color: '#4B5563',
      to: '/admin',
    },
    {
      label: 'Avis clients',
      value: String(stats?.reviewsTotal ?? 0),
      icon: MessageSquare,
      color: '#CA8A04',
      to: '/admin',
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#1F2937]">Tableau de bord</h1>
        <p className="text-sm text-gray-500 mt-1">Vue d’ensemble de la marketplace AfriZone</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-2xl border animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <Link
                  key={c.label}
                  to={c.to}
                  className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-[#FF6B00]/40 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${c.color}18` }}
                    >
                      <Icon size={20} style={{ color: c.color }} />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-[#1F2937]">{c.value}</p>
                  <p className="text-xs text-gray-500 mt-1 font-semibold">{c.label}</p>
                </Link>
              );
            })}
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <h2 className="font-extrabold mb-2">Commandes</h2>
              <p className="text-sm text-gray-600">
                Total : <strong>{stats?.ordersTotal ?? 0}</strong>
              </p>
              <p className="text-sm text-gray-600">
                Livrées : <strong>{stats?.ordersDelivered ?? 0}</strong>
              </p>
              <Link to="/admin/commandes" className="inline-block mt-3 text-sm font-bold text-[#FF6B00]">
                Gérer les commandes →
              </Link>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <h2 className="font-extrabold mb-2">Réseau</h2>
              <p className="text-sm text-gray-600">
                Vendeurs approuvés : <strong>{stats?.vendorsApproved ?? 0}</strong>
              </p>
              <p className="text-sm text-gray-600">
                Livreurs approuvés : <strong>{stats?.driversApproved ?? 0}</strong>
              </p>
              <Link to="/admin/vendeurs" className="inline-block mt-3 text-sm font-bold text-[#FF6B00]">
                Voir les vendeurs →
              </Link>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <h2 className="font-extrabold mb-2">Colis</h2>
              <p className="text-sm text-gray-600">
                Total : <strong>{stats?.parcelsTotal ?? 0}</strong>
              </p>
              <p className="text-sm text-gray-600">
                En cours : <strong>{stats?.parcelsActive ?? 0}</strong>
              </p>
              <Link to="/admin/colis" className="inline-block mt-3 text-sm font-bold text-[#FF6B00]">
                Voir les colis →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
