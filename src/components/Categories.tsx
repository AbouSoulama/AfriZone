import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Smartphone,
  TabletSmartphone,
  Laptop,
  Plug,
  Shirt,
  Footprints,
  Gem,
  Scissors,
  Home,
  Sofa,
  Sparkles,
  HeartPulse,
  Baby,
  Utensils,
  Dumbbell,
  BookOpen,
  Gamepad2,
  Car,
  Bike,
  Wrench,
  Sun,
  Wheat,
  Palette,
  Tag,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from 'lucide-react';
import { countProductsByCategory } from '../services/catalog';
import { CATEGORY_NAMES } from '../lib/catalog-config';
import SectionHeading from './SectionHeading';

interface CategoryStyle {
  icon: LucideIcon;
  tint: string;
  glow: string;
}

const STYLES: Record<string, CategoryStyle> = {
  'Électronique': { icon: Smartphone, tint: 'from-orange-400 to-[#F25500]', glow: 'rgba(255,107,0,0.35)' },
  'Téléphones & Tablettes': { icon: TabletSmartphone, tint: 'from-cyan-400 to-blue-600', glow: 'rgba(14,165,233,0.3)' },
  Informatique: { icon: Laptop, tint: 'from-slate-400 to-indigo-700', glow: 'rgba(79,70,229,0.3)' },
  'Électroménager': { icon: Plug, tint: 'from-teal-400 to-cyan-600', glow: 'rgba(13,148,136,0.3)' },
  Mode: { icon: Shirt, tint: 'from-pink-400 to-rose-600', glow: 'rgba(225,29,72,0.3)' },
  'Chaussures & Maroquinerie': { icon: Footprints, tint: 'from-amber-500 to-orange-700', glow: 'rgba(217,119,6,0.3)' },
  'Bijoux & Accessoires': { icon: Gem, tint: 'from-yellow-300 to-amber-500', glow: 'rgba(245,158,11,0.35)' },
  'Tissus & Pagnes': { icon: Scissors, tint: 'from-red-400 to-fuchsia-600', glow: 'rgba(192,38,211,0.3)' },
  Maison: { icon: Home, tint: 'from-amber-300 to-orange-500', glow: 'rgba(245,158,11,0.35)' },
  'Meubles & Décoration': { icon: Sofa, tint: 'from-orange-300 to-amber-600', glow: 'rgba(180,83,9,0.3)' },
  'Beauté': { icon: Sparkles, tint: 'from-fuchsia-400 to-purple-600', glow: 'rgba(168,85,247,0.3)' },
  'Santé & Bien-être': { icon: HeartPulse, tint: 'from-rose-400 to-red-600', glow: 'rgba(220,38,38,0.3)' },
  'Bébé & Enfants': { icon: Baby, tint: 'from-sky-300 to-blue-500', glow: 'rgba(59,130,246,0.3)' },
  Alimentation: { icon: Utensils, tint: 'from-emerald-400 to-[#00A651]', glow: 'rgba(0,166,81,0.32)' },
  Sport: { icon: Dumbbell, tint: 'from-sky-400 to-blue-600', glow: 'rgba(37,99,235,0.3)' },
  Livres: { icon: BookOpen, tint: 'from-indigo-400 to-violet-600', glow: 'rgba(99,102,241,0.3)' },
  'Jeux & Consoles': { icon: Gamepad2, tint: 'from-violet-400 to-purple-700', glow: 'rgba(126,34,206,0.3)' },
  Auto: { icon: Car, tint: 'from-slate-500 to-slate-800', glow: 'rgba(30,41,59,0.3)' },
  'Moto & Vélos': { icon: Bike, tint: 'from-lime-400 to-green-600', glow: 'rgba(22,163,74,0.3)' },
  'Bricolage & Outillage': { icon: Wrench, tint: 'from-zinc-400 to-zinc-700', glow: 'rgba(63,63,70,0.3)' },
  'Énergie & Solaire': { icon: Sun, tint: 'from-yellow-300 to-orange-500', glow: 'rgba(249,115,22,0.35)' },
  'Agriculture & Élevage': { icon: Wheat, tint: 'from-lime-300 to-emerald-600', glow: 'rgba(5,150,105,0.3)' },
  'Artisanat & Art': { icon: Palette, tint: 'from-orange-400 to-pink-600', glow: 'rgba(236,72,153,0.3)' },
};

const FALLBACK: CategoryStyle = {
  icon: Tag,
  tint: 'from-gray-400 to-gray-600',
  glow: 'rgba(75,85,99,0.3)',
};

/** Nombre de catégories visibles avant « Voir toutes les catégories ». */
const COLLAPSED_COUNT = 8;

export default function Categories() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    countProductsByCategory().then(setCounts);
  }, []);

  const visible = expanded ? CATEGORY_NAMES : CATEGORY_NAMES.slice(0, COLLAPSED_COUNT);

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
        {visible.map((name) => {
          const cat = STYLES[name] ?? FALLBACK;
          const Icon = cat.icon;
          const count = counts[name] ?? 0;
          return (
            <Link
              key={name}
              to={`/catalogue?category=${encodeURIComponent(name)}`}
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
                  {name}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
                  {count > 0 ? `${count} produit${count > 1 ? 's' : ''}` : 'Explorer'}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {CATEGORY_NAMES.length > COLLAPSED_COUNT && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white border border-black/5 text-sm font-bold text-[#1F2937] hover:text-[#FF6B00] hover:shadow-premium-lg transition-all"
          >
            {expanded ? (
              <>
                Voir moins <ChevronUp size={16} />
              </>
            ) : (
              <>
                Voir toutes les catégories ({CATEGORY_NAMES.length}) <ChevronDown size={16} />
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
