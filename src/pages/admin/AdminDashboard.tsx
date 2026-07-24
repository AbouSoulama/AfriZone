import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Bike,
  CheckCircle2,
  Clock,
  MessageSquare,
  Package,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatPrice } from '../../services/catalog';
import {
  fetchAdminDashboardData,
  ORDER_STATUS_LABELS,
  type AdminDashboardData,
} from '../../services/admin-dashboard';
import type { OrderStatus } from '../../services/orders';

const STATUS_BAR: Array<{ key: OrderStatus; color: string }> = [
  { key: 'pending', color: '#9CA3AF' },
  { key: 'confirmed', color: '#FF6B00' },
  { key: 'processing', color: '#2563EB' },
  { key: 'shipped', color: '#7C3AED' },
  { key: 'delivered', color: '#00A651' },
  { key: 'cancelled', color: '#EF4444' },
];

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setData(await fetchAdminDashboardData());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = data?.stats;
  const alerts =
    (stats?.vendorsPending ?? 0) + (stats?.driversPending ?? 0) + (stats?.ordersOpen ?? 0);

  const kpi = [
    {
      label: 'CA encaissé',
      value: formatPrice(stats?.revenuePaid ?? 0),
      sub: 'Commandes payées',
      icon: TrendingUp,
      color: '#FF6B00',
      to: '/admin/commandes',
    },
    {
      label: 'Commandes ouvertes',
      value: String(stats?.ordersOpen ?? 0),
      sub: `${stats?.ordersTotal ?? 0} au total`,
      icon: ShoppingBag,
      color: '#2563EB',
      to: '/admin/commandes',
    },
    {
      label: 'Utilisateurs',
      value: String(stats?.usersTotal ?? 0),
      sub: `${stats?.clientsTotal ?? 0} clients`,
      icon: Users,
      color: '#7C3AED',
      to: '/admin',
    },
    {
      label: 'À valider',
      value: String((stats?.vendorsPending ?? 0) + (stats?.driversPending ?? 0)),
      sub: `${stats?.vendorsPending ?? 0} vendeurs · ${stats?.driversPending ?? 0} livreurs`,
      icon: AlertCircle,
      color: '#EA580C',
      to: '/admin/vendeurs',
    },
  ];

  const secondary = [
    {
      label: 'Vendeurs approuvés',
      value: stats?.vendorsApproved ?? 0,
      icon: Store,
      to: '/admin/vendeurs',
    },
    {
      label: 'Livreurs approuvés',
      value: stats?.driversApproved ?? 0,
      icon: Bike,
      to: '/admin/livreurs',
    },
    {
      label: 'Colis actifs',
      value: stats?.parcelsActive ?? 0,
      icon: Package,
      to: '/admin/colis',
    },
    {
      label: 'Produits actifs',
      value: stats?.productsActive ?? 0,
      icon: Package,
      to: '/admin',
    },
    {
      label: 'Avis clients',
      value: stats?.reviewsTotal ?? 0,
      icon: MessageSquare,
      to: '/admin',
    },
    {
      label: 'Commandes livrées',
      value: stats?.ordersDelivered ?? 0,
      icon: CheckCircle2,
      to: '/admin/commandes',
    },
  ];

  const maxStatus = Math.max(1, ...STATUS_BAR.map((s) => stats?.ordersByStatus[s.key] ?? 0));

  return (
    <div className="max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#FF6B00] mb-1">
            Administration
          </p>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#1F2937]">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-1">
            Bonjour {user?.fullName?.split(' ')[0] || 'Admin'} — vue d’ensemble AfriZone
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/commandes"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF6B00] text-white rounded-xl text-sm font-bold hover:bg-[#E05E00]"
          >
            Commandes
          </Link>
          <Link
            to="/admin/vendeurs"
            className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold hover:border-[#FF6B00]"
          >
            Vendeurs
          </Link>
          <Link
            to="/admin/livraisons"
            className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold hover:border-[#00A651]"
          >
            Courses
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-white rounded-2xl border animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-white rounded-2xl border animate-pulse" />
        </div>
      ) : (
        <>
          {/* Alertes */}
          {alerts > 0 && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Clock className="text-amber-600 shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-bold text-sm text-amber-900">Actions en attente</p>
                  <p className="text-xs text-amber-800 mt-0.5">
                    {stats?.ordersOpen ?? 0} commande(s) ouverte(s) ·{' '}
                    {stats?.vendorsPending ?? 0} vendeur(s) · {stats?.driversPending ?? 0}{' '}
                    livreur(s) à valider
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {(stats?.vendorsPending ?? 0) > 0 && (
                  <Link
                    to="/admin/vendeurs"
                    className="px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-bold text-amber-900"
                  >
                    Valider vendeurs
                  </Link>
                )}
                {(stats?.ordersOpen ?? 0) > 0 && (
                  <Link
                    to="/admin/commandes"
                    className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold"
                  >
                    Voir commandes
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* KPI principaux */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {kpi.map((c) => {
              const Icon = c.icon;
              return (
                <Link
                  key={c.label}
                  to={c.to}
                  className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-[#FF6B00]/50 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
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
                  <p className="text-xs text-gray-500 mt-1">{c.sub}</p>
                </Link>
              );
            })}
          </div>

          {/* Secondaires */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {secondary.map((s) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.label}
                  to={s.to}
                  className="bg-white border border-gray-100 rounded-xl p-3 hover:border-gray-300 transition-colors"
                >
                  <Icon size={16} className="text-gray-400 mb-2" />
                  <p className="text-lg font-extrabold text-[#1F2937]">{s.value}</p>
                  <p className="text-[11px] text-gray-500 font-semibold leading-tight">{s.label}</p>
                </Link>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-5 gap-6 mb-6">
            {/* Répartition commandes */}
            <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-5">
              <h2 className="font-extrabold text-[#1F2937] mb-1">Répartition des commandes</h2>
              <p className="text-xs text-gray-500 mb-4">Par statut</p>
              <div className="space-y-3">
                {STATUS_BAR.map((s) => {
                  const n = stats?.ordersByStatus[s.key] ?? 0;
                  const pct = Math.round((n / maxStatus) * 100);
                  return (
                    <div key={s.key}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-gray-600">
                          {ORDER_STATUS_LABELS[s.key]}
                        </span>
                        <span className="font-bold text-[#1F2937]">{n}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: s.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Commandes récentes */}
            <div className="lg:col-span-3 bg-white border border-gray-100 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-extrabold text-[#1F2937]">Commandes récentes</h2>
                  <p className="text-xs text-gray-500">8 dernières</p>
                </div>
                <Link
                  to="/admin/commandes"
                  className="text-xs font-bold text-[#FF6B00] inline-flex items-center gap-1"
                >
                  Tout voir <ArrowRight size={14} />
                </Link>
              </div>

              {!data?.recentOrders.length ? (
                <p className="text-sm text-gray-500 py-8 text-center">Aucune commande pour le moment.</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {data.recentOrders.map((o) => (
                    <li key={o.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-[#FF6B00] truncate">
                          {o.orderNumber}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {o.vendorName || 'Vendeur'} · {o.shippingCity} ·{' '}
                          {new Date(o.createdAt).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-extrabold">{formatPrice(o.total)}</p>
                        <span className="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-[#FF6B00]">
                          {ORDER_STATUS_LABELS[o.status]}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Files d'attente validation */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-extrabold text-[#1F2937]">Vendeurs en attente</h2>
                <Link to="/admin/vendeurs" className="text-xs font-bold text-[#FF6B00]">
                  Gérer →
                </Link>
              </div>
              {!data?.pendingVendors.length ? (
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#00A651]" /> Aucune demande en attente
                </p>
              ) : (
                <ul className="space-y-3">
                  {data.pendingVendors.map((v) => (
                    <li
                      key={v.id}
                      className="flex items-center justify-between gap-2 border border-gray-50 rounded-xl px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-bold">{v.shopName}</p>
                        <p className="text-xs text-gray-500">
                          {v.city} · {new Date(v.createdAt).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <Link
                        to="/admin/vendeurs"
                        className="text-xs font-bold px-2.5 py-1 bg-[#00A651] text-white rounded-lg"
                      >
                        Valider
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-extrabold text-[#1F2937]">Livreurs en attente</h2>
                <Link to="/admin/livreurs" className="text-xs font-bold text-[#FF6B00]">
                  Gérer →
                </Link>
              </div>
              {!data?.pendingDrivers.length ? (
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#00A651]" /> Aucune demande en attente
                </p>
              ) : (
                <ul className="space-y-3">
                  {data.pendingDrivers.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-2 border border-gray-50 rounded-xl px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-bold font-mono">{d.driverCode}</p>
                        <p className="text-xs text-gray-500">
                          {d.city} · {new Date(d.createdAt).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <Link
                        to="/admin/livreurs"
                        className="text-xs font-bold px-2.5 py-1 bg-[#00A651] text-white rounded-lg"
                      >
                        Valider
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
