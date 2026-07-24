import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, Package, Shield, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="hidden md:flex w-64 flex-col bg-[#1F2937] text-white">
        <div className="p-5 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-[#FF6B00]" />
            <span className="font-extrabold">Admin AfriZone</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">{user?.fullName}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLink
            to="/admin/vendeurs"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold ${
                isActive ? 'bg-[#FF6B00]' : 'text-gray-300 hover:bg-gray-800'
              }`
            }
          >
            <Users size={18} /> Vendeurs
          </NavLink>
          <NavLink
            to="/admin/colis"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold ${
                isActive ? 'bg-[#FF6B00]' : 'text-gray-300 hover:bg-gray-800'
              }`
            }
          >
            <Package size={18} /> Colis
          </NavLink>
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

      <main className="flex-1 p-4 md:p-8">
        <div className="md:hidden mb-4 flex gap-2 flex-wrap">
          <Link
            to="/admin/vendeurs"
            className="px-3 py-1.5 bg-[#FF6B00] text-white rounded-full text-xs font-bold"
          >
            Vendeurs
          </Link>
          <Link
            to="/admin/colis"
            className="px-3 py-1.5 bg-gray-800 text-white rounded-full text-xs font-bold"
          >
            Colis
          </Link>
          <Link to="/" className="px-3 py-1.5 bg-gray-200 rounded-full text-xs font-bold">
            Site
          </Link>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
