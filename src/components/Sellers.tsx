import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Award,
  Star,
  Store,
  MapPin,
} from 'lucide-react';
import { fetchFeaturedVendors } from '../services/catalog';
import { useCity } from '../context/CityContext';
import type { CatalogVendor } from '../types/catalog';

function SellerCard({ seller }: { seller: CatalogVendor }) {
  return (
    <div className="flex-shrink-0 w-72 bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 group">
      <div className="relative h-28 overflow-hidden bg-gradient-to-r from-[#FF6B00]/80 to-[#00A651]/80">
        {seller.shopLogoUrl && (
          <img
            src={seller.shopLogoUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
        )}
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#00A651] text-white px-2 py-1 rounded-full text-[10px] font-extrabold shadow-lg">
          <CheckCircle size={11} />
          VÉRIFIÉ
        </div>
        {seller.rating >= 4.8 && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-gradient-to-r from-yellow-400 to-amber-500 text-white px-2 py-1 rounded-full text-[10px] font-extrabold shadow-lg">
            <Award size={11} className="fill-white" />
            TOP
          </div>
        )}
      </div>

      <div className="relative px-4 -mt-8">
        <div className="w-16 h-16 rounded-2xl border-4 border-white overflow-hidden shadow-lg bg-white">
          {seller.shopLogoUrl ? (
            <img src={seller.shopLogoUrl} alt={seller.shopName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Store size={24} className="text-gray-300" />
            </div>
          )}
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-base font-extrabold text-[#1F2937] mb-1 group-hover:text-[#FF6B00] transition-colors">
          {seller.shopName}
        </h3>
        <p className="text-xs text-gray-500 mb-3">{seller.shopCategory || 'Boutique'}</p>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-0.5">
            <Star size={13} className="text-[#FFD700] fill-[#FFD700]" />
            <span className="text-xs font-bold text-[#1F2937]">{seller.rating.toFixed(1)}</span>
          </div>
          <span className="text-xs text-gray-400">•</span>
          <span className="text-xs text-gray-500">
            {seller.totalSales.toLocaleString('fr-FR')}+ ventes
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-4">
          <span className="flex items-center gap-1 font-mono">{seller.vendorCode}</span>
          <span className="flex items-center gap-1">
            <MapPin size={12} /> {seller.city}
          </span>
        </div>

        <Link
          to={`/boutique/${seller.shopSlug}`}
          className="w-full py-2 bg-[#FF6B00] text-white rounded-lg text-xs font-bold hover:bg-[#E05E00] transition-colors flex items-center justify-center gap-1"
        >
          <Store size={13} /> Visiter boutique
        </Link>
      </div>
    </div>
  );
}

export default function Sellers() {
  const { city } = useCity();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [sellers, setSellers] = useState<CatalogVendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFeaturedVendors(8, city).then((list) => {
      if (!cancelled) {
        setSellers(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [city]);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    setCanScrollLeft(scrollRef.current.scrollLeft > 0);
    setCanScrollRight(
      scrollRef.current.scrollLeft <
        scrollRef.current.scrollWidth - scrollRef.current.clientWidth - 10
    );
  };

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
    setTimeout(checkScroll, 400);
  };

  return (
    <section className="bg-gradient-to-b from-gray-50 to-white py-10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#1F2937]">
              Vendeurs <span className="text-[#00A651]">vedettes</span>
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Les meilleurs vendeurs vérifiés à {city}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                canScrollLeft
                  ? 'border-gray-200 hover:border-[#FF6B00] hover:text-[#FF6B00] text-gray-600'
                  : 'border-gray-100 text-gray-300 cursor-not-allowed'
              }`}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                canScrollRight
                  ? 'border-gray-200 hover:border-[#FF6B00] hover:text-[#FF6B00] text-gray-600'
                  : 'border-gray-100 text-gray-300 cursor-not-allowed'
              }`}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex gap-5 overflow-hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="w-72 h-64 bg-white rounded-2xl border animate-pulse shrink-0" />
            ))}
          </div>
        ) : sellers.length === 0 ? (
          <div className="bg-white border rounded-2xl p-8 text-center text-sm text-gray-500">
            Aucun vendeur approuvé pour le moment. Lancez le seed démo ou validez un vendeur.
          </div>
        ) : (
          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="flex gap-5 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4"
          >
            {sellers.map((seller) => (
              <SellerCard key={seller.id} seller={seller} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
