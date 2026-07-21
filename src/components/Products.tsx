import { useState } from 'react';
import { Star, Heart, ShoppingCart, Eye, CheckCircle, Award, Flame, Tag, ChevronRight } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  price: number;
  oldPrice?: number;
  image: string;
  rating: number;
  reviews: number;
  seller: string;
  sellerType: 'verified' | 'gold' | 'standard';
  badge?: string;
  badgeColor?: string;
  city: string;
}

const products: Product[] = [
  {
    id: 1,
    name: 'iPhone 15 Pro Max 256GB',
    price: 850000,
    oldPrice: 950000,
    image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400&h=400&fit=crop',
    rating: 4.8,
    reviews: 234,
    seller: 'TechDakar',
    sellerType: 'gold',
    badge: '-10%',
    badgeColor: '#FF6B00',
    city: 'Dakar',
  },
  {
    id: 2,
    name: 'Boubou Brodé Traditionnel',
    price: 35000,
    image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&h=400&fit=crop',
    rating: 4.9,
    reviews: 156,
    seller: 'ModeAfrique',
    sellerType: 'verified',
    badge: 'Nouveau',
    badgeColor: '#00A651',
    city: 'Dakar',
  },
  {
    id: 3,
    name: 'Smart TV Samsung 55" 4K',
    price: 420000,
    oldPrice: 480000,
    image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400&h=400&fit=crop',
    rating: 4.7,
    reviews: 89,
    seller: 'ElectroPlus',
    sellerType: 'gold',
    badge: '-12%',
    badgeColor: '#FF6B00',
    city: 'Ouagadougou',
  },
  {
    id: 4,
    name: 'Shea Butter Bio 500g',
    price: 8500,
    image: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=400&h=400&fit=crop',
    rating: 4.9,
    reviews: 412,
    seller: 'BeautéNaturelle',
    sellerType: 'verified',
    badge: 'Best-seller',
    badgeColor: '#FFD700',
    city: 'Ouagadougou',
  },
  {
    id: 5,
    name: 'Casque Gaming RGB Pro',
    price: 28000,
    oldPrice: 35000,
    image: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400&h=400&fit=crop',
    rating: 4.6,
    reviews: 67,
    seller: 'GamingZone',
    sellerType: 'standard',
    badge: '-20%',
    badgeColor: '#FF6B00',
    city: 'Dakar',
  },
  {
    id: 6,
    name: 'Montre Connectée Sport',
    price: 45000,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop',
    rating: 4.5,
    reviews: 198,
    seller: 'SportMax',
    sellerType: 'verified',
    city: 'Bamako',
  },
  {
    id: 7,
    name: 'Tissu Wax Premium 6 yards',
    price: 15000,
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop',
    rating: 4.8,
    reviews: 321,
    seller: 'WaxEmpire',
    sellerType: 'gold',
    badge: 'Populaire',
    badgeColor: '#00A651',
    city: 'Dakar',
  },
  {
    id: 8,
    name: 'Café Touba Artisanal 1kg',
    price: 6500,
    image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=400&fit=crop',
    rating: 4.9,
    reviews: 287,
    seller: 'CaféDakar',
    sellerType: 'verified',
    city: 'Dakar',
  },
];

function formatPrice(price: number) {
  return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA';
}

function ProductCard({ product }: { product: Product }) {
  const [liked, setLiked] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <div className="relative overflow-hidden bg-gray-50">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
          loading="lazy"
        />
        {/* Badge */}
        {product.badge && (
          <span
            className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-extrabold text-white shadow-md"
            style={{ backgroundColor: product.badgeColor }}
          >
            {product.badge}
          </span>
        )}
        {/* Favorite */}
        <button
          onClick={() => setLiked(!liked)}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
            liked ? 'bg-[#FF6B00] text-white' : 'bg-white/90 text-gray-400 hover:text-[#FF6B00]'
          } shadow-md`}
        >
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
        </button>
        {/* Quick actions overlay */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 p-3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setCartAdded(!cartAdded)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#FF6B00] text-white rounded-lg text-xs font-semibold hover:bg-[#E05E00] shadow-lg transition-all"
          >
            <ShoppingCart size={14} />
            {cartAdded ? 'Ajouté!' : 'Panier'}
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 bg-white text-[#1F2937] rounded-lg text-xs font-semibold hover:bg-gray-100 shadow-lg">
            <Eye size={14} />
            Voir
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-1 mb-2">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={12}
                className={s <= Math.round(product.rating) ? 'text-[#FFD700] fill-[#FFD700]' : 'text-gray-200'}
              />
            ))}
          </div>
          <span className="text-xs font-semibold text-gray-500">({product.reviews})</span>
        </div>

        <h3 className="text-sm font-bold text-[#1F2937] mb-2 line-clamp-2 min-h-[40px] group-hover:text-[#FF6B00] transition-colors">
          {product.name}
        </h3>

        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-lg font-extrabold text-[#FF6B00]">{formatPrice(product.price)}</p>
            {product.oldPrice && (
              <p className="text-xs text-gray-400 line-through">{formatPrice(product.oldPrice)}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5">
            {product.sellerType === 'gold' && (
              <span className="flex items-center gap-1 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 px-2 py-0.5 rounded-full">
                <Award size={10} className="text-yellow-500 fill-yellow-500" />
                <span className="text-[10px] font-bold text-yellow-700">Gold</span>
              </span>
            )}
            {product.sellerType === 'verified' && (
              <span className="flex items-center gap-1 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                <CheckCircle size={10} className="text-[#00A651]" />
                <span className="text-[10px] font-bold text-[#00A651]">Vérifié</span>
              </span>
            )}
            <span className="text-xs font-semibold text-gray-600">{product.seller}</span>
          </div>
          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
            <Tag size={10} /> {product.city}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Products() {
  const [activeTab, setActiveTab] = useState('popular');
  const tabs = [
    { id: 'popular', label: 'Populaires', icon: Flame },
    { id: 'new', label: 'Nouveautés', icon: Tag },
    { id: 'deals', label: 'Bonnes affaires', icon: Tag },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#1F2937]">
            Produits <span className="text-[#FF6B00]">populaires</span>
          </h2>
          <p className="text-sm text-gray-500 mt-1">Ce que nos clients adorent en ce moment</p>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 rounded-full p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-[#FF6B00] shadow-sm'
                    : 'text-gray-500 hover:text-[#1F2937]'
                }`}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <div className="text-center mt-8">
        <button className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-[#FF6B00] text-[#FF6B00] rounded-full font-bold text-sm hover:bg-[#FF6B00] hover:text-white transition-all">
          Voir tous les produits <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
}
