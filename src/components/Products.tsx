import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Tag, ChevronRight } from 'lucide-react';
import ProductCard from './catalog/ProductCard';
import { fetchFeaturedProducts } from '../services/catalog';
import type { CatalogProduct } from '../types/catalog';

export default function Products() {
  const [activeTab, setActiveTab] = useState('popular');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchFeaturedProducts(8).then((list) => {
      if (!cancelled) {
        setProducts(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-72 bg-white rounded-2xl border animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
          <p className="text-gray-600 mb-3">Aucun produit en base pour le moment.</p>
          <p className="text-xs text-gray-400 mb-4">
            Exécutez <code className="bg-gray-100 px-1 rounded">003_seed_demo_catalog.sql</code> dans
            Supabase SQL Editor.
          </p>
          <Link
            to="/catalogue"
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

      <div className="text-center mt-8">
        <Link
          to="/catalogue"
          className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-[#FF6B00] text-[#FF6B00] rounded-full font-bold text-sm hover:bg-[#FF6B00] hover:text-white transition-all"
        >
          Voir tous les produits <ChevronRight size={16} />
        </Link>
      </div>
    </section>
  );
}
