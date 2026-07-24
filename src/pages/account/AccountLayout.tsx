import { Link, NavLink, Navigate, Outlet } from 'react-router-dom';
import { MapPin, User } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useAuth } from '../../context/AuthContext';

const nav = [
  { to: '/compte', end: true, label: 'Mon profil', icon: User },
  { to: '/compte/adresses', end: false, label: 'Mes adresses', icon: MapPin },
];

export default function AccountLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/auth/login" replace state={{ from: '/compte' }} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#1F2937]">Mon compte</h1>
          <p className="text-sm text-gray-500 mt-1">
            {user?.fullName}
            {user?.role === 'vendeur' && user.vendor?.shopName
              ? ` · ${user.vendor.shopName}`
              : ''}
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <aside className="md:w-56 shrink-0">
            <nav className="bg-white border border-gray-100 rounded-2xl p-2 space-y-1">
              {nav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold ${
                        isActive
                          ? 'bg-[#FF6B00] text-white'
                          : 'text-gray-600 hover:bg-orange-50'
                      }`
                    }
                  >
                    <Icon size={16} /> {item.label}
                  </NavLink>
                );
              })}
            </nav>
            <div className="mt-3 flex flex-col gap-1 text-sm">
              <Link to="/commandes" className="px-3 py-2 text-gray-500 hover:text-[#FF6B00]">
                Mes commandes
              </Link>
              <Link to="/colis/mes-envois" className="px-3 py-2 text-gray-500 hover:text-[#FF6B00]">
                Mes envois
              </Link>
            </div>
          </aside>
          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
