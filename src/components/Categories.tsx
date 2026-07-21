import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Smartphone,
  Shirt,
  Home,
  Sparkles,
  Utensils,
  Dumbbell,
  BookOpen,
  Car,
  ChevronRight,
} from 'lucide-react';
import { countProductsByCategory } from '../services/catalog';

const categories = [
  { name: 'Électronique', icon: Smartphone, color: '#FF6B00', bg: 'from-orange-100 to-orange-50' },
  { name: 'Mode', icon: Shirt, color: '#00A651', bg: 'from-green-100 to-green-50' },
  { name: 'Maison', icon: Home, color: '#FF6B00', bg: 'from-orange-100 to-orange-50' },
  { name: 'Beauté', icon: Sparkles, color: '#00A651', bg: 'from-green-100 to-green-50' },
  { name: 'Alimentation', icon: Utensils, color: '#FF6B00', bg: 'from-orange-100 to-orange-50' },
  { name: 'Sport', icon: Dumbbell, color: '#00A651', bg: 'from-green-100 to-green-50' },
  { name: 'Livres', icon: BookOpen, color: '#FF6B00', bg: 'from-orange-100 to-orange-50' },
  { name: 'Auto', icon: Car, color: '#00A651', bg: 'from-green-100 to-green-50' },
];

export default function Categories() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    countProductsByCategory().then(setCounts);
  }, []);

  return (
    <section className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#1F2937]">
            Catégories <span className="text-[#FF6B00]">principales</span>
          </h2>
          <p className="text-sm text-gray-500 mt-1">Explorez nos univers produits</p>
        </div>
        <Link
          to="/catalogue"
          className="hidden sm:flex items-center gap-1 text-sm font-semibold text-[#00A651] hover:text-[#008A43] transition-colors"
        >
          Voir tout <ChevronRight size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const count = counts[cat.name] ?? 0;
          return (
            <Link
              key={cat.name}
              to={`/catalogue?category=${encodeURIComponent(cat.name)}`}
              className={`group flex flex-col items-center gap-3 p-4 bg-gradient-to-b ${cat.bg} rounded-2xl border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300`}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-3 duration-300"
                style={{ backgroundColor: cat.color }}
              >
                <Icon size={26} className="text-white" />
              </div>
              <div className="text-center">
                <p className="font-bold text-sm text-[#1F2937] group-hover:text-[#FF6B00] transition-colors">
                  {cat.name}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {count > 0 ? `${count} produit${count > 1 ? 's' : ''}` : 'Explorer'}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
