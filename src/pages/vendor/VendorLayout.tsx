import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, LogOut, Store, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const nav = [
  { to: '/vendeur', end: true, label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/vendeur/produits', end: false, label: 'Mes produits', icon: Package },
];

export default function VendorLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="hidden md:flex w-64 flex-col bg-[#1F2937] text-white">
        <div className="p-5 border-b border-gray-700">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-afrizone.png" alt="AfriZone" className="h-10 bg-white rounded-lg p-1" />
          </Link>
          <p className="mt-3 text-xs text-gray-400">Espace vendeur</p>
          <p className="font-bold truncate">{user?.vendor?.shopName || user?.fullName}</p>
          {user?.vendor?.vendorCode && (
            <p className="text-xs font-mono text-[#FF6B00] mt-1">{user.vendor.vendorCode}</p>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    isActive ? 'bg-[#FF6B00] text-white' : 'text-gray-300 hover:bg-gray-800'
                  }`
                }
              >
                <Icon size={18} /> {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-3 border-t border-gray-700 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-gray-300 hover:bg-gray-800"
          >
            <ArrowLeft size={16} /> Retour site
          </Link>
          <button
            onClick={async () => {
              await logout();
              navigate('/auth/login');
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-red-300 hover:bg-gray-800"
          >
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden bg-white border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store size={18} className="text-[#FF6B00]" />
            <span className="font-bold text-sm truncate">{user?.vendor?.shopName}</span>
          </div>
          <Link to="/" className="text-xs text-[#FF6B00] font-semibold">
            Site
          </Link>
        </header>
        <nav className="md:hidden flex gap-2 overflow-x-auto px-4 py-2 bg-white border-b">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                  isActive ? 'bg-[#FF6B00] text-white' : 'bg-gray-100 text-gray-600'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
