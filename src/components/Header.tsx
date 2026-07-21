import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShoppingCart, MapPin, User, Menu, X, ChevronDown, Truck, Shield, Headphones, CreditCard } from 'lucide-react';

const cities = ['Dakar', 'Ouagadougou', 'Bamako', 'Abidjan', 'Lomé', 'Cotonou'];

export default function Header() {
  const [city, setCity] = useState('Dakar');
  const [cityOpen, setCityOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
          <div className="flex items-center gap-2 shrink-0">
            <img
              src="/logo-afrizone.png"
              alt="AfriZone - Achetez. Vendez. Expédiez."
              className="h-12 w-auto object-contain"
            />
          </div>

          {/* Search bar */}
          <div className="hidden md:flex flex-1 max-w-xl relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un produit, une marque, un vendeur..."
              className="w-full pl-4 pr-12 py-2.5 border-2 border-gray-200 rounded-full focus:border-[#FF6B00] focus:outline-none transition-colors text-sm"
            />
            <button className="absolute right-1 top-1/2 -translate-y-1/2 bg-[#FF6B00] text-white p-2 rounded-full hover:bg-[#E05E00] transition-colors">
              <Search size={18} />
            </button>
          </div>

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
                    onClick={() => { setCity(c); setCityOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-orange-50 hover:text-[#FF6B00] transition-colors ${city === c ? 'text-[#FF6B00] font-semibold bg-orange-50' : ''}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cart */}
          <button className="relative p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ShoppingCart size={22} className="text-[#1F2937]" />
            <span className="absolute -top-0.5 -right-0.5 bg-[#FF6B00] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">3</span>
          </button>

          {/* Auth buttons */}
          <div className="hidden sm:flex items-center gap-2">
            <Link to="/auth/login" className="px-4 py-2 text-sm font-semibold text-[#1F2937] hover:text-[#FF6B00] transition-colors">
              Connexion
            </Link>
            <Link to="/auth/register/client" className="px-4 py-2 text-sm font-semibold bg-[#00A651] text-white rounded-lg hover:bg-[#008A43] transition-colors shadow-sm">
              Inscription
            </Link>
          </div>

          {/* Mobile auth */}
          <Link to="/auth/login" className="sm:hidden p-2 hover:bg-gray-100 rounded-full">
            <User size={22} />
          </Link>
        </div>

        {/* Mobile search */}
        <div className="md:hidden mt-3 relative">
          <input
            type="text"
            placeholder="Rechercher..."
            className="w-full pl-4 pr-12 py-2.5 border-2 border-gray-200 rounded-full focus:border-[#FF6B00] focus:outline-none text-sm"
          />
          <button className="absolute right-1 top-1/2 -translate-y-1/2 bg-[#FF6B00] text-white p-2 rounded-full">
            <Search size={18} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 py-4 px-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={16} className="text-[#FF6B00]" />
            <select value={city} onChange={(e) => setCity(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
              {cities.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <nav className="flex flex-col gap-1">
            {['Accueil', 'Catégories', 'Vendeurs', 'Envoi Colis', 'Promotions'].map(item => (
              <a key={item} href="#" className="px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-[#FF6B00] font-medium text-sm transition-colors">{item}</a>
            ))}
          </nav>
          <div className="flex gap-2 mt-4">
            <Link to="/auth/login" className="flex-1 px-4 py-2.5 text-sm font-semibold border-2 border-[#00A651] text-[#00A651] rounded-lg text-center">Connexion</Link>
            <Link to="/auth/register/client" className="flex-1 px-4 py-2.5 text-sm font-semibold bg-[#00A651] text-white rounded-lg text-center">Inscription</Link>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="hidden lg:block border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1">
            {['Toutes les catégories', 'Électronique', 'Mode', 'Maison', 'Beauté', 'Alimentation', 'Envoi de Colis'].map((item, i) => (
              <a
                key={item}
                href="#"
                className={`px-4 py-3 text-sm font-semibold transition-colors hover:text-[#FF6B00] ${i === 0 ? 'text-[#FF6B00] bg-orange-50' : 'text-[#1F2937]'}`}
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
}
