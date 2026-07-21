import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, MapPin, User, Menu, X, ChevronDown, Truck, Shield, Headphones, CreditCard, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const cities = ['Dakar', 'Ouagadougou', 'Bamako'];

const navItems = [
  { label: 'Toutes les catégories', to: '/catalogue' },
  { label: 'Électronique', to: '/catalogue?category=%C3%89lectronique' },
  { label: 'Mode', to: '/catalogue?category=Mode' },
  { label: 'Maison', to: '/catalogue?category=Maison' },
  { label: 'Beauté', to: '/catalogue?category=Beaut%C3%A9' },
  { label: 'Alimentation', to: '/catalogue?category=Alimentation' },
  { label: 'Envoi de Colis', to: '/catalogue' },
];

export default function Header() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [city, setCity] = useState('Dakar');
  const [cityOpen, setCityOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const goSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = searchQuery.trim();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (city) params.set('city', city);
    navigate(`/catalogue?${params.toString()}`);
    setMobileMenuOpen(false);
  };

  return (
    <header className={`sticky top-0 z-50 bg-white transition-shadow duration-300 ${scrolled ? 'shadow-lg' : 'shadow-sm'}`}>
      {/* Top bar */}
      <div className="bg-[#1F2937] text-white text-xs py-1.5">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><Truck size={12} /> Livraison rapide</span>
            <span className="hidden sm:flex items-center gap-1"><Shield size={12} /> Paiement sécurisé</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden md:flex items-center gap-1"><Headphones size={12} /> Support 24/7</span>
            <span className="flex items-center gap-1"><CreditCard size={12} /> FCFA</span>
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Mobile menu button */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img
              src="/logo-afrizone.png"
              alt="AfriZone - Achetez. Vendez. Expédiez."
              className="h-12 w-auto object-contain"
            />
          </Link>

          {/* Search bar */}
          <form onSubmit={goSearch} className="hidden md:flex flex-1 max-w-xl relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un produit, une marque, un vendeur..."
              className="w-full pl-4 pr-12 py-2.5 border-2 border-gray-200 rounded-full focus:border-[#FF6B00] focus:outline-none transition-colors text-sm"
            />
            <button
              type="submit"
              className="absolute right-1 top-1/2 -translate-y-1/2 bg-[#FF6B00] text-white p-2 rounded-full hover:bg-[#E05E00] transition-colors"
            >
              <Search size={18} />
            </button>
          </form>

          {/* City selector */}
          <div className="relative hidden lg:block">
            <button
              onClick={() => setCityOpen(!cityOpen)}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg hover:border-[#FF6B00] transition-colors text-sm"
            >
              <MapPin size={16} className="text-[#FF6B00]" />
              <span className="font-medium">{city}</span>
              <ChevronDown size={14} className={`transition-transform ${cityOpen ? 'rotate-180' : ''}`} />
            </button>
            {cityOpen && (
              <div className="absolute top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 animate-fade-in">
                {cities.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setCity(c);
                      setCityOpen(false);
                      navigate(`/catalogue?city=${encodeURIComponent(c)}`);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-orange-50 hover:text-[#FF6B00] transition-colors ${city === c ? 'text-[#FF6B00] font-semibold bg-orange-50' : ''}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cart */}
          <Link to="/catalogue" className="relative p-2 hover:bg-gray-100 rounded-full transition-colors" title="Catalogue">
            <ShoppingCart size={22} className="text-[#1F2937]" />
          </Link>

          {/* Auth */}
          {!isLoading && (
            <>
              {isAuthenticated && user ? (
                <div className="relative hidden sm:block">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#FF6B00] text-white flex items-center justify-center text-sm font-bold">
                      {user.fullName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-[#1F2937] max-w-[120px] truncate">
                      {user.fullName.split(' ')[0]}
                    </span>
                    <ChevronDown size={14} />
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-xs text-gray-500 capitalize">
                          {user.role === 'vendeur'
                            ? `Vendeur${user.vendor?.vendorCode ? ` · ${user.vendor.vendorCode}` : ''}`
                            : user.role}
                        </p>
                        <p className="text-sm font-semibold truncate">{user.fullName}</p>
                        {user.role === 'vendeur' && user.vendor?.shopName && (
                          <p className="text-xs text-[#00A651] truncate">{user.vendor.shopName}</p>
                        )}
                      </div>
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
                  <Link to="/auth/login" className="px-4 py-2 text-sm font-semibold text-[#1F2937] hover:text-[#FF6B00] transition-colors">
                    Connexion
                  </Link>
                  <Link to="/auth/register/client" className="px-4 py-2 text-sm font-semibold bg-[#00A651] text-white rounded-lg hover:bg-[#008A43] transition-colors shadow-sm">
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
            className="w-full pl-4 pr-12 py-2.5 border-2 border-gray-200 rounded-full focus:border-[#FF6B00] focus:outline-none text-sm"
          />
          <button
            type="submit"
            className="absolute right-1 top-1/2 -translate-y-1/2 bg-[#FF6B00] text-white p-2 rounded-full"
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
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                navigate(`/catalogue?city=${encodeURIComponent(e.target.value)}`);
              }}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {cities.map((c) => (
                <option key={c}>{c}</option>
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
              to="/auth/register/vendor"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-[#FF6B00] font-medium text-sm"
            >
              Devenir vendeur
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
                  to="/auth/register/client"
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
      <nav className="hidden lg:block border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1">
            {navItems.map((item, i) => (
              <Link
                key={item.label}
                to={item.to}
                className={`px-4 py-3 text-sm font-semibold transition-colors hover:text-[#FF6B00] ${
                  i === 0 ? 'text-[#FF6B00] bg-orange-50' : 'text-[#1F2937]'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
}
