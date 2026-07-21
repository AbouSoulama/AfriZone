import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle, Award, Star, Store, Package, MapPin, Shield } from 'lucide-react';

interface Seller {
  id: number;
  name: string;
  logo: string;
  cover: string;
  type: 'gold' | 'verified' | 'standard';
  rating: number;
  sales: string;
  products: number;
  city: string;
  category: string;
  since: string;
}

const sellers: Seller[] = [
  {
    id: 1,
    name: 'TechDakar',
    logo: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=200&h=200&fit=crop',
    cover: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=300&fit=crop',
    type: 'gold',
    rating: 4.9,
    sales: '12 500+',
    products: 340,
    city: 'Dakar',
    category: 'Électronique',
    since: '2021',
  },
  {
    id: 2,
    name: 'ModeAfrique',
    logo: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=200&h=200&fit=crop',
    cover: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&h=300&fit=crop',
    type: 'verified',
    rating: 4.8,
    sales: '8 200+',
    products: 520,
    city: 'Dakar',
    category: 'Mode',
    since: '2022',
  },
  {
    id: 3,
    name: 'BeautéNaturelle',
    logo: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=200&h=200&fit=crop',
    cover: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&h=300&fit=crop',
    type: 'gold',
    rating: 5.0,
    sales: '25 000+',
    products: 180,
    city: 'Ouagadougou',
    category: 'Beauté',
    since: '2020',
  },
  {
    id: 4,
    name: 'ElectroPlus',
    logo: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=200&h=200&fit=crop',
    cover: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600&h=300&fit=crop',
    type: 'verified',
    rating: 4.7,
    sales: '5 800+',
    products: 220,
    city: 'Ouagadougou',
    category: 'Électronique',
    since: '2023',
  },
  {
    id: 5,
    name: 'WaxEmpire',
    logo: 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=200&h=200&fit=crop',
    cover: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=300&fit=crop',
    type: 'gold',
    rating: 4.9,
    sales: '18 300+',
    products: 450,
    city: 'Dakar',
    category: 'Mode',
    since: '2019',
  },
  {
    id: 6,
    name: 'CaféDakar',
    logo: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=200&h=200&fit=crop',
    cover: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=600&h=300&fit=crop',
    type: 'verified',
    rating: 4.8,
    sales: '9 100+',
    products: 85,
    city: 'Dakar',
    category: 'Alimentation',
    since: '2021',
  },
];

function SellerCard({ seller }: { seller: Seller }) {
  return (
    <div className="flex-shrink-0 w-72 bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 group">
      {/* Cover */}
      <div className="relative h-28 overflow-hidden">
        <img src={seller.cover} alt={seller.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        {seller.type === 'gold' && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-gradient-to-r from-yellow-400 to-amber-500 text-white px-2 py-1 rounded-full text-[10px] font-extrabold shadow-lg">
            <Award size={11} className="fill-white" />
            GOLD SELLER
          </div>
        )}
        {seller.type === 'verified' && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#00A651] text-white px-2 py-1 rounded-full text-[10px] font-extrabold shadow-lg">
            <CheckCircle size={11} />
            VÉRIFIÉ
          </div>
        )}
      </div>

      {/* Logo */}
      <div className="relative px-4 -mt-8">
        <div className="relative inline-block">
          <div className="w-16 h-16 rounded-2xl border-4 border-white overflow-hidden shadow-lg bg-white">
            <img src={seller.logo} alt={seller.name} className="w-full h-full object-cover" />
          </div>
          {seller.type !== 'standard' && (
            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow">
              {seller.type === 'gold' ? (
                <Award size={16} className="text-yellow-500 fill-yellow-500" />
              ) : (
                <CheckCircle size={16} className="text-[#00A651] fill-[#00A651]" />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-base font-extrabold text-[#1F2937] mb-1 group-hover:text-[#FF6B00] transition-colors">{seller.name}</h3>
        <p className="text-xs text-gray-500 mb-3">{seller.category}</p>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-0.5">
            <Star size={13} className="text-[#FFD700] fill-[#FFD700]" />
            <span className="text-xs font-bold text-[#1F2937]">{seller.rating}</span>
          </div>
          <span className="text-xs text-gray-400">•</span>
          <span className="text-xs text-gray-500">{seller.sales} ventes</span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-4">
          <span className="flex items-center gap-1"><Package size={12} /> {seller.products} produits</span>
          <span className="flex items-center gap-1"><MapPin size={12} /> {seller.city}</span>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex-1 py-2 bg-[#FF6B00] text-white rounded-lg text-xs font-bold hover:bg-[#E05E00] transition-colors flex items-center justify-center gap-1">
            <Store size={13} /> Visiter boutique
          </button>
          <button className="py-2 px-3 border border-gray-200 rounded-lg hover:border-[#00A651] hover:text-[#00A651] transition-colors">
            <Shield size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sellers() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    setCanScrollLeft(scrollRef.current.scrollLeft > 0);
    setCanScrollRight(
      scrollRef.current.scrollLeft < scrollRef.current.scrollWidth - scrollRef.current.clientWidth - 10
    );
  };

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = dir === 'left' ? -300 : 300;
    scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
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
            <p className="text-sm text-gray-500 mt-1">Les meilleurs vendeurs vérifiés par AfriZone</p>
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

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-5 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4"
        >
          {sellers.map((seller) => (
            <SellerCard key={seller.id} seller={seller} />
          ))}
        </div>
      </div>
    </section>
  );
}
