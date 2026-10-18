import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Tag, ChevronRight } from 'lucide-react';
import ProductCard from './catalog/ProductCard';
import SectionHeading from './SectionHeading';
import { fetchFeaturedProducts } from '../services/catalog';
import { useCountry } from '../context/CountryContext';
import type { CatalogProduct } from '../types/catalog';

export default function Products() {
  const { country, countryName } = useCountry();
  const [activeTab, setActiveTab] = useState('popular');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFeaturedProducts(8, country).then((list) => {
      if (!cancelled) {
        setProducts(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [country]);

  const tabs = [
    { id: 'popular', label: 'Populaires', icon: Flame },
    { id: 'new', label: 'Nouveautés', icon: Tag },
    { id: 'deals', label: 'Bonnes affaires', icon: Tag },
  ];

  const visible = (() => {
    if (activeTab === 'new') {
      return [...products].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    if (activeTab === 'deals') {
      return products.filter((p) => p.oldPrice != null && p.oldPrice > p.price);
    }
    return products;
  })();

  return (
    <section className="max-w-7xl mx-auto px-4 py-14">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-8">
        <SectionHeading
          eyebrow="Sélection"
          title="Produits"
          highlight="populaires"
          subtitle={`Ce que nos clients adorent au ${countryName}`}
        />
        <div className="flex items-center gap-1 bg-white border border-black/5 shadow-premium rounded-2xl p-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-[#0B0F19] text-white shadow-lg'
                    : 'text-gray-500 hover:text-[#1F2937] hover:bg-gray-50'
                }`}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-80 rounded-3xl bg-gradient-to-r from-white via-gray-100 to-white animate-shimmer" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
          <p className="text-gray-600 mb-3">Aucun produit trouvé au {countryName} pour le moment.</p>
          <Link
            to={`/catalogue?country=${country}`}
            className="inline-flex items-center gap-2 text-[#FF6B00] font-bold text-sm"
          >
            Voir le catalogue <ChevronRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
          {visible.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      <div className="text-center mt-10">
        <Link
          to={`/catalogue?country=${country}`}
          className="sheen inline-flex items-center gap-2 px-7 py-3.5 bg-[#0B0F19] text-white rounded-2xl font-bold text-sm shadow-[0_18px_40px_-18px_rgba(11,15,25,0.8)] hover:-translate-y-0.5 transition-all"
        >
          Voir tous les produits <ChevronRight size={16} />
        </Link>
      </div>
    </section>
  );
}
