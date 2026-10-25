import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, MapPin, User, Menu, X, ChevronDown, Truck, Shield, Headphones, CreditCard, LogOut, PackageSearch, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useCountry } from '../context/CountryContext';
import BrandLogo from './BrandLogo';
import NotificationBell from './NotificationBell';
import { fetchActiveSubscription } from '../services/subscriptions';

const navItems = [
  { label: 'Toutes les catégories', to: '/catalogue' },
  { label: 'Électronique', to: '/catalogue?category=%C3%89lectronique' },
  { label: 'Mode', to: '/catalogue?category=Mode' },
  { label: 'Maison', to: '/catalogue?category=Maison' },
  { label: 'Beauté', to: '/catalogue?category=Beaut%C3%A9' },
  { label: 'Alimentation', to: '/catalogue?category=Alimentation' },
  { label: 'Suivre ma commande', to: '/commandes' },
  { label: 'Envoi de Colis', to: '/colis' },
];

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { itemCount } = useCart();
  const { country, countryName, setCountry, countries } = useCountry();
  const [countryOpen, setCountryOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [isClub, setIsClub] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user || user.role === 'livreur') {
      setIsClub(false);
      return;
    }
    let cancelled = false;
    fetchActiveSubscription()
      .then((sub) => {
        if (!cancelled) {
          setIsClub(sub?.planCode === 'client_club' || sub?.planCode === 'vendor_pro' || sub?.planCode === 'vendor_business');
        }
      })
      .catch(() => {
        if (!cancelled) setIsClub(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id, user?.role]);

  const goSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = searchQuery.trim();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (country) params.set('country', country);
    navigate(`/catalogue?${params.toString()}`);
    setMobileMenuOpen(false);
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-white/80 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_10px_40px_-18px_rgba(16,24,40,0.35)] border-b border-black/5'
          : 'bg-white border-b border-transparent'
      }`}
    >
      {/* Top bar */}
      <div className="bg-[#1F2937] text-white/75 text-[11px] font-medium tracking-wide py-2">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5">
              <Truck size={12} className="text-[#FF8A2B]" /> Livraison suivie
            </span>
            <span className="hidden sm:flex items-center gap-1.5">
              <Shield size={12} className="text-[#1BC46B]" /> Paiement sécurisé
            </span>
          </div>
          <div className="flex items-center gap-5">
            <Link
              to="/commandes"
              className="hidden sm:flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <PackageSearch size={12} /> Suivre ma commande
            </Link>
            <Link
              to="/abonnements"
              className="hidden sm:flex items-center gap-1.5 text-[#FFB067] hover:text-white transition-colors font-semibold"
            >
              <Crown size={12} /> Abonnements
            </Link>
            <span className="hidden md:flex items-center gap-1.5"><Headphones size={12} /> Support 24/7</span>
            <span className="flex items-center gap-1.5"><CreditCard size={12} /> FCFA</span>
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="max-w-7xl mx-auto px-4 py-3.5">
        <div className="flex items-center justify-between gap-4">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2.5 rounded-xl hover:bg-gray-100 transition-colors"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <BrandLogo size="md" />

          {/* Search bar */}
          <form onSubmit={goSearch} className="hidden md:flex flex-1 max-w-xl relative group">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#FF6B00] transition-colors"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un produit, une marque, un vendeur..."
              className="w-full pl-11 pr-28 py-3 bg-gray-100/80 border border-transparent rounded-2xl focus:bg-white focus:border-[#FF6B00]/40 focus:outline-none text-sm placeholder:text-gray-400"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#FF6B00] text-white px-4 py-2 rounded-xl text-xs font-bold"
            >
              Rechercher
            </button>
          </form>

          {/* City selector */}
          <div className="relative hidden lg:block">
            <button
              onClick={() => setCountryOpen(!countryOpen)}
              className="flex items-center gap-2 pl-2 pr-3 py-2 bg-white border border-gray-200/80 rounded-2xl hover:border-[#FF6B00]/40 hover:shadow-md transition-all text-sm"
            >
              <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center">
                <MapPin size={14} className="text-[#FF6B00]" />
              </span>
              <span className="font-semibold">{countryName}</span>
              <ChevronDown size={14} className={`text-gray-400 transition-transform ${countryOpen ? 'rotate-180' : ''}`} />
            </button>
            {countryOpen && (
              <div className="absolute top-full mt-2 w-52 glass shadow-premium-lg rounded-2xl p-1.5 z-50 animate-fade-in">
                {countries.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => {
                      setCountry(c.code);
                      setCountryOpen(false);
                      if (location.pathname.startsWith('/catalogue')) {
                        const params = new URLSearchParams(location.search);
                        params.set('country', c.code);
                        params.delete('city');
                        navigate(`/catalogue?${params.toString()}`);
                      }
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm hover:bg-orange-50 hover:text-[#FF6B00] transition-colors ${country === c.code ? 'text-[#FF6B00] font-bold bg-orange-50/80' : 'font-medium'}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notifications + Cart */}
          {isAuthenticated && <NotificationBell />}
          <Link
            to="/panier"
            className="relative w-11 h-11 flex items-center justify-center rounded-2xl bg-white border border-gray-200/80 hover:border-[#FF6B00]/40 hover:shadow-md transition-all"
            title="Panier"
          >
            <ShoppingCart size={20} className="text-[#1F2937]" />
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 bg-[#FF6B00] text-white text-[10px] font-extrabold rounded-full flex items-center justify-center ring-2 ring-white">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </Link>

          {/* Auth */}
          {!isLoading && (
            <>
              {isAuthenticated && user ? (
                <div className="relative hidden sm:block">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-2xl bg-white border border-gray-200/80 hover:border-[#FF6B00]/40 hover:shadow-md transition-all"
                  >
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FF8A2B] to-[#F25500] text-white flex items-center justify-center text-sm font-bold overflow-hidden shadow-glow-orange">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        user.fullName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="text-sm font-semibold text-[#1F2937] max-w-[120px] truncate">
                      {user.fullName.split(' ')[0]}
                    </span>
                    {isClub && (
                      <span className="hidden lg:inline-flex items-center gap-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#FF6B00] bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                        <Crown size={10} /> Club
                      </span>
                    )}
                    <ChevronDown size={14} />
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-60 glass shadow-premium-lg rounded-2xl p-1.5 z-50 animate-fade-in [&>a]:rounded-xl [&>button]:rounded-xl">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-xs text-gray-500 capitalize">
                          {user.role === 'vendeur'
                            ? `Vendeur${user.vendor?.vendorCode ? ` · ${user.vendor.vendorCode}` : ''}`
                            : user.role}
                        </p>
                        <p className="text-sm font-semibold truncate">{user.fullName}</p>
                        {isClub && (
                          <p className="text-[10px] font-bold text-[#FF6B00] mt-0.5 uppercase">
                            Abonnement actif
                          </p>
                        )}
                        {user.role === 'vendeur' && user.vendor?.shopName && (
                          <p className="text-xs text-[#00A651] truncate">{user.vendor.shopName}</p>
                        )}
                      </div>
                      <Link
                        to="/compte"
                        onClick={() => setUserMenuOpen(false)}
                        className="block px-4 py-2 text-sm hover:bg-orange-50 font-semibold"
                      >
                        Mon compte
                      </Link>
                      <Link
                        to={
                          user.role === 'vendeur'
                            ? '/vendeur/abonnement'
                            : '/compte/abonnement'
                        }
                        onClick={() => setUserMenuOpen(false)}
                        className="block px-4 py-2 text-sm hover:bg-orange-50 text-[#FF6B00] font-semibold"
                      >
                        Abonnement
                      </Link>
                      <Link
                        to="/notifications"
                        onClick={() => setUserMenuOpen(false)}
                        className="block px-4 py-2 text-sm hover:bg-orange-50"
                      >
                        Notifications
                      </Link>
                      <Link
                        to="/commandes"
                        onClick={() => setUserMenuOpen(false)}
                        className="block px-4 py-2 text-sm hover:bg-orange-50 font-semibold text-[#FF6B00]"
                      >
                        Suivre ma commande
                      </Link>
                      <Link
                        to="/colis/mes-envois"
                        onClick={() => setUserMenuOpen(false)}
                        className="block px-4 py-2 text-sm hover:bg-orange-50"
                      >
                        Mes envois
                      </Link>
                      <Link
                        to="/panier"
                        onClick={() => setUserMenuOpen(false)}
                        className="block px-4 py-2 text-sm hover:bg-orange-50"
                      >
                        Panier
                      </Link>
                      {user.role === 'vendeur' && (
                        <Link
                          to="/vendeur"
                          onClick={() => setUserMenuOpen(false)}
                          className="block px-4 py-2 text-sm hover:bg-orange-50 text-[#FF6B00] font-semibold"
                        >
                          Espace vendeur
                        </Link>
                      )}
                      {user.role === 'livreur' && (
                        <Link
                          to="/livreur"
                          onClick={() => setUserMenuOpen(false)}
                          className="block px-4 py-2 text-sm hover:bg-orange-50 text-[#FF6B00] font-semibold"
                        >
                          Espace livreur
                        </Link>
                      )}
                      {user.role === 'admin' && (
                        <Link
                          to="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="block px-4 py-2 text-sm hover:bg-orange-50 text-[#FF6B00] font-semibold"
                        >
                          Tableau de bord admin
                        </Link>
                      )}
                      <button
                        onClick={async () => {
                          setUserMenuOpen(false);
                          await logout();
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut size={14} /> Déconnexion
          </button>
                    </div>
                  )}
                </div>
              ) : (
          <div className="hidden sm:flex items-center gap-2">
            <Link to="/auth/login" className="px-4 py-2.5 text-sm font-bold text-[#1F2937] rounded-2xl hover:bg-gray-100 transition-colors">
              Connexion
            </Link>
                  <Link to="/auth/register" className="px-5 py-2.5 text-sm font-bold bg-[#00A651] text-white rounded-2xl hover:-translate-y-0.5">
              Inscription
            </Link>
          </div>
              )}

              <Link
                to={isAuthenticated ? '/' : '/auth/login'}
                className="sm:hidden p-2 hover:bg-gray-100 rounded-full"
                onClick={async (e) => {
                  if (isAuthenticated) {
                    e.preventDefault();
                    await logout();
                  }
                }}
              >
                {isAuthenticated ? <LogOut size={22} /> : <User size={22} />}
          </Link>
            </>
          )}
        </div>

        {/* Mobile search */}
        <form onSubmit={goSearch} className="md:hidden mt-3 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-4 pr-12 py-3 bg-gray-100/80 border border-transparent rounded-2xl focus:bg-white focus:border-[#FF6B00]/40 focus:outline-none text-sm"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#FF6B00] text-white p-2 rounded-xl"
          >
            <Search size={18} />
          </button>
        </form>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 py-4 px-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={16} className="text-[#FF6B00]" />
            <select
              value={country}
              onChange={(e) => {
                const next = e.target.value as typeof country;
                setCountry(next);
                if (location.pathname.startsWith('/catalogue')) {
                  const params = new URLSearchParams(location.search);
                  params.set('country', next);
                  params.delete('city');
                  navigate(`/catalogue?${params.toString()}`);
                }
              }}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <nav className="flex flex-col gap-1">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-[#FF6B00] font-medium text-sm"
            >
              Accueil
            </Link>
            <Link
              to="/catalogue"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-[#FF6B00] font-medium text-sm"
            >
              Catalogue
            </Link>
            <Link
              to="/panier"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-[#FF6B00] font-medium text-sm"
            >
              Panier{itemCount > 0 ? ` (${itemCount})` : ''}
            </Link>
            <Link
              to="/commandes"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-orange-50 text-[#FF6B00] font-bold text-sm"
            >
              Suivre ma commande
            </Link>
            {isAuthenticated && (
              <Link
                to="/compte"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-[#FF6B00] font-medium text-sm"
              >
                Mon compte
              </Link>
            )}
            {isAuthenticated && user?.role === 'vendeur' && (
              <Link
                to="/vendeur"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-orange-50 text-[#FF6B00] font-bold text-sm"
              >
                Dashboard vendeur
              </Link>
            )}
            {isAuthenticated && user?.role === 'livreur' && (
              <Link
                to="/livreur"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-orange-50 text-[#FF6B00] font-bold text-sm"
              >
                Dashboard livreur
              </Link>
            )}
            {isAuthenticated && user?.role === 'admin' && (
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-orange-50 text-[#FF6B00] font-bold text-sm"
              >
                Dashboard admin
              </Link>
            )}
            {isAuthenticated && (
              <Link
                to={
                  user?.role === 'vendeur'
                    ? '/vendeur/abonnement'
                    : '/compte/abonnement'
                }
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-[#FF6B00] font-medium text-sm"
              >
                Abonnement
              </Link>
            )}
            {isAuthenticated && (
              <Link
                to="/notifications"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-[#FF6B00] font-medium text-sm"
              >
                Notifications
              </Link>
            )}
            <Link
              to="/colis"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-[#FF6B00] font-medium text-sm"
            >
              Envoi de colis
            </Link>
            <Link
              to="/suivi"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-[#FF6B00] font-medium text-sm"
            >
              Suivre un colis
            </Link>
            <Link
              to="/auth/register/vendor"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-[#FF6B00] font-medium text-sm"
            >
              Devenir vendeur
            </Link>
            <Link
              to="/auth/register/driver"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-[#FF6B00] font-medium text-sm"
            >
              Devenir livreur
            </Link>
          </nav>
          <div className="flex gap-2 mt-4">
            {isAuthenticated && user ? (
              <button
                onClick={async () => {
                  setMobileMenuOpen(false);
                  await logout();
                }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold border-2 border-red-200 text-red-600 rounded-lg text-center"
              >
                Déconnexion ({user.fullName.split(' ')[0]})
              </button>
            ) : (
              <>
                <Link
                  to="/auth/login"
                  className="flex-1 px-4 py-2.5 text-sm font-semibold border-2 border-[#00A651] text-[#00A651] rounded-lg text-center"
                >
                  Connexion
                </Link>
                <Link
                  to="/auth/register"
                  className="flex-1 px-4 py-2.5 text-sm font-semibold bg-[#00A651] text-white rounded-lg text-center"
                >
                  Inscription
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="hidden lg:block border-t border-black/[0.04]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const [path, query] = item.to.split('?');
              const active =
                location.pathname === path &&
                (query ? location.search === `?${query}` : !location.search || path !== '/catalogue');
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`relative px-4 py-3 text-[13px] font-semibold transition-colors hover:text-[#FF6B00] group ${
                    active ? 'text-[#FF6B00]' : 'text-[#1F2937]/80'
                  }`}
                >
                  {item.label}
                  <span
                    className={`absolute left-4 right-4 bottom-0 h-[3px] rounded-full bg-gradient-to-r from-[#FF8A2B] to-[#00A651] transition-all duration-300 origin-left ${
                      active ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-100'
                    }`}
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </header>
  );
}
