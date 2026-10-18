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
  ArrowUpRight,
} from 'lucide-react';
import { countProductsByCategory } from '../services/catalog';
import SectionHeading from './SectionHeading';

const categories = [
  { name: 'Électronique', icon: Smartphone, tint: 'from-orange-400 to-[#F25500]', glow: 'rgba(255,107,0,0.35)' },
  { name: 'Mode', icon: Shirt, tint: 'from-pink-400 to-rose-600', glow: 'rgba(225,29,72,0.3)' },
  { name: 'Maison', icon: Home, tint: 'from-amber-300 to-orange-500', glow: 'rgba(245,158,11,0.35)' },
  { name: 'Beauté', icon: Sparkles, tint: 'from-fuchsia-400 to-purple-600', glow: 'rgba(168,85,247,0.3)' },
  { name: 'Alimentation', icon: Utensils, tint: 'from-emerald-400 to-[#00A651]', glow: 'rgba(0,166,81,0.32)' },
  { name: 'Sport', icon: Dumbbell, tint: 'from-sky-400 to-blue-600', glow: 'rgba(37,99,235,0.3)' },
  { name: 'Livres', icon: BookOpen, tint: 'from-indigo-400 to-violet-600', glow: 'rgba(99,102,241,0.3)' },
  { name: 'Auto', icon: Car, tint: 'from-slate-500 to-slate-800', glow: 'rgba(30,41,59,0.3)' },
];

export default function Categories() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    countProductsByCategory().then(setCounts);
  }, []);

  return (
    <section className="max-w-7xl mx-auto px-4 pt-16 pb-6">
      <div className="flex items-end justify-between mb-8 gap-4">
        <SectionHeading
          eyebrow="Univers"
          title="Catégories"
          highlight="principales"
          subtitle="Explorez nos univers produits"
        />
        <Link
          to="/catalogue"
          className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white border border-black/5 text-sm font-bold text-[#1F2937] hover:text-[#FF6B00] hover:shadow-premium-lg transition-all"
        >
          Voir tout <ArrowUpRight size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 md:gap-4">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const count = counts[cat.name] ?? 0;
          return (
            <Link
              key={cat.name}
              to={`/catalogue?category=${encodeURIComponent(cat.name)}`}
              className="sheen group relative flex flex-col items-center gap-3 px-3 pt-6 pb-5 bg-white rounded-3xl border border-black/[0.04] hover:-translate-y-1.5 hover:shadow-premium-lg transition-all duration-500"
            >
              <span
                className="absolute inset-x-6 -bottom-2 h-8 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: cat.glow }}
              />
              <div
                className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${cat.tint} flex items-center justify-center shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:-rotate-6`}
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/35 to-transparent" />
                <Icon size={28} className="relative text-white drop-shadow" />
              </div>
              <div className="relative text-center">
                <p className="font-bold text-sm text-[#1F2937] group-hover:text-[#FF6B00] transition-colors">
                  {cat.name}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
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
