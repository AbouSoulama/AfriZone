import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bike,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  ShoppingBag,
  Store,
  Truck,
  Users,
  UserSquare2,
  Wallet,
  Crown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  AdminCountryProvider,
  useAdminCountry,
} from '../../context/AdminCountryContext';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/commandes', label: 'Commandes', icon: ShoppingBag },
  { to: '/admin/utilisateurs', label: 'Utilisateurs', icon: UserSquare2 },
  { to: '/admin/catalogue', label: 'Boutiques', icon: Store },
  { to: '/admin/vendeurs', label: 'Vendeurs', icon: Users },
  { to: '/admin/livreurs', label: 'Livreurs', icon: Bike },
  { to: '/admin/suivi-gps', label: 'Suivi GPS', icon: MapPin },
  { to: '/admin/livraisons', label: 'Courses', icon: Truck },
  { to: '/admin/retraits', label: 'Retraits', icon: Wallet },
  { to: '/admin/abonnements', label: 'Abonnements', icon: Crown },
  { to: '/admin/colis', label: 'Colis', icon: Package },
];

function AdminCountryBar() {
  const { adminCountry, setAdminCountry, countries } = useAdminCountry();
  return (
    <div className="mb-5 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50/70 px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-bold text-[#1F2937]">
        <MapPin size={16} className="text-[#FF6B00]" />
        Pays de gestion
      </div>
      <select
        value={adminCountry}
        onChange={(e) =>
          setAdminCountry(e.target.value as typeof adminCountry)
        }
        className="sm:ml-auto border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold bg-white focus:border-[#FF6B00] focus:outline-none"
      >
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.label}
          </option>
        ))}
        <option value="ALL">Tous les pays</option>
      </select>
      <p className="text-xs text-gray-600 sm:max-w-xs">
        Commandes, vendeurs, livreurs et courses sont filtrés selon ce pays.
      </p>
    </div>
  );
}

function AdminShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { adminCountryName } = useAdminCountry();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="hidden md:flex w-64 flex-col bg-[#1F2937] text-white">
        <div className="p-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <img
              src="/logo-afrizone.png"
              alt="AfriZone"
              className="h-10 w-10 object-contain bg-white rounded-xl p-1"
            />
            <div>
              <span className="font-extrabold block leading-tight">Admin AfriZone</span>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[140px]">
                {user?.fullName}
              </p>
              <p className="text-[10px] text-[#FF6B00] font-bold mt-0.5">{adminCountryName}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold ${
                    isActive ? 'bg-[#FF6B00]' : 'text-gray-300 hover:bg-gray-800'
                  }`
                }
              >
                <Icon size={18} /> {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-3 border-t border-gray-700 space-y-1">
          <Link to="/" className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-300">
            <ArrowLeft size={16} /> Site
          </Link>
          <button
            onClick={async () => {
              await logout();
              navigate('/auth/login');
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-300"
          >
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
        <div className="md:hidden mb-4 flex items-center gap-3">
          <img
            src="/logo-afrizone.png"
            alt="AfriZone"
            className="h-9 w-9 object-contain bg-white rounded-lg p-0.5 border"
          />
          <div>
            <p className="font-extrabold text-sm">Admin AfriZone</p>
            <p className="text-xs text-gray-500">
              {user?.fullName} · {adminCountryName}
            </p>
          </div>
        </div>
        <div className="md:hidden mb-4 flex gap-2 flex-wrap">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="px-3 py-1.5 bg-gray-800 text-white rounded-full text-xs font-bold"
            >
              {item.label}
            </Link>
          ))}
        </div>
        <AdminCountryBar />
        <Outlet />
      </main>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <AdminCountryProvider>
      <AdminShell />
    </AdminCountryProvider>
  );
}
