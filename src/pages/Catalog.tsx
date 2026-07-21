import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard from '../components/catalog/ProductCard';
import { fetchProducts } from '../services/catalog';
import {
  CATALOG_CATEGORIES,
  CATALOG_CITIES,
  type CatalogFilters,
  type CatalogProduct,
  type CatalogSort,
  type ProductCondition,
} from '../types/catalog';

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileFilters, setMobileFilters] = useState(false);

  const filters: CatalogFilters = useMemo(
    () => ({
      q: searchParams.get('q') || undefined,
      category: searchParams.get('category') || undefined,
      city: searchParams.get('city') || undefined,
      minPrice: searchParams.get('min') ? Number(searchParams.get('min')) : undefined,
      maxPrice: searchParams.get('max') ? Number(searchParams.get('max')) : undefined,
      condition: (searchParams.get('condition') as ProductCondition) || undefined,
      verifiedOnly: searchParams.get('verified') === '1',
      sort: (searchParams.get('sort') as CatalogSort) || 'relevance',
      page: Number(searchParams.get('page') || 1),
      pageSize: 12,
    }),
    [searchParams]
  );

  const [draftMin, setDraftMin] = useState(searchParams.get('min') || '');
  const [draftMax, setDraftMax] = useState(searchParams.get('max') || '');
  const [draftQ, setDraftQ] = useState(searchParams.get('q') || '');

  useEffect(() => {
    setDraftQ(searchParams.get('q') || '');
    setDraftMin(searchParams.get('min') || '');
    setDraftMax(searchParams.get('max') || '');
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchProducts(filters)
      .then((res) => {
        if (cancelled) return;
        setProducts(res.products);
        setTotal(res.total);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || 'Impossible de charger le catalogue');
        setProducts([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters]);

  const updateParam = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const applyPrice = () => {
    const next = new URLSearchParams(searchParams);
    if (draftMin) next.set('min', draftMin);
    else next.delete('min');
    if (draftMax) next.set('max', draftMax);
    else next.delete('max');
    next.delete('page');
    setSearchParams(next);
  };

  const clearFilters = () => {
    setSearchParams({});
    setDraftMin('');
    setDraftMax('');
    setDraftQ('');
  };

  const totalPages = Math.max(1, Math.ceil(total / (filters.pageSize || 12)));
  const page = filters.page || 1;

  const FiltersPanel = (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-extrabold text-[#1F2937] mb-3">Catégorie</h3>
        <div className="space-y-1">
          <button
            onClick={() => updateParam('category')}
            className={`block w-full text-left px-3 py-2 rounded-lg text-sm ${
              !filters.category ? 'bg-orange-50 text-[#FF6B00] font-semibold' : 'hover:bg-gray-50'
            }`}
          >
            Toutes
          </button>
          {CATALOG_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => updateParam('category', cat)}
              className={`block w-full text-left px-3 py-2 rounded-lg text-sm ${
                filters.category === cat
                  ? 'bg-orange-50 text-[#FF6B00] font-semibold'
                  : 'hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-extrabold text-[#1F2937] mb-3">Ville</h3>
        <select
          value={filters.city || ''}
          onChange={(e) => updateParam('city', e.target.value || undefined)}
          className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-[#FF6B00] focus:outline-none"
        >
          <option value="">Toutes les villes</option>
          {CATALOG_CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <h3 className="text-sm font-extrabold text-[#1F2937] mb-3">Prix (FCFA)</h3>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            value={draftMin}
            onChange={(e) => setDraftMin(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-[#FF6B00] focus:outline-none"
          />
          <input
            type="number"
            placeholder="Max"
            value={draftMax}
            onChange={(e) => setDraftMax(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-[#FF6B00] focus:outline-none"
          />
        </div>
        <button
          onClick={applyPrice}
          className="mt-2 w-full py-2 bg-[#1F2937] text-white rounded-xl text-sm font-semibold"
        >
          Appliquer
        </button>
      </div>

      <div>
        <h3 className="text-sm font-extrabold text-[#1F2937] mb-3">État</h3>
        <div className="flex gap-2">
          {(['', 'neuf', 'occasion'] as const).map((c) => (
            <button
              key={c || 'all'}
              onClick={() => updateParam('condition', c || undefined)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 ${
                (filters.condition || '') === c
                  ? 'border-[#FF6B00] text-[#FF6B00] bg-orange-50'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              {c === '' ? 'Tous' : c === 'neuf' ? 'Neuf' : 'Occasion'}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={Boolean(filters.verifiedOnly)}
          onChange={(e) => updateParam('verified', e.target.checked ? '1' : undefined)}
          className="accent-[#00A651]"
        />
        <span className="text-sm text-gray-700">Vendeur vérifié uniquement</span>
      </label>

      <button
        onClick={clearFilters}
        className="w-full py-2.5 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:border-gray-300"
      >
        Réinitialiser
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-sm text-[#FF6B00] font-semibold mb-1">
              <Link to="/" className="hover:underline">
                Accueil
              </Link>{' '}
              / Catalogue
            </p>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#1F2937]">
              Catalogue produits
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {loading ? 'Chargement...' : `${total} produit${total > 1 ? 's' : ''} trouvé${total > 1 ? 's' : ''}`}
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateParam('q', draftQ.trim() || undefined);
            }}
            className="flex gap-2 w-full md:w-auto"
          >
            <div className="relative flex-1 md:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
                placeholder="Rechercher..."
                className="w-full pl-9 pr-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-[#FF6B00] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 bg-[#FF6B00] text-white rounded-xl text-sm font-bold"
            >
              Chercher
            </button>
          </form>
        </div>

        <div className="flex items-center justify-between gap-3 mb-4">
          <button
            onClick={() => setMobileFilters(true)}
            className="lg:hidden inline-flex items-center gap-2 px-4 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold"
          >
            <Filter size={16} /> Filtres
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <SlidersHorizontal size={16} className="text-gray-400" />
            <select
              value={filters.sort || 'relevance'}
              onChange={(e) => updateParam('sort', e.target.value)}
              className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-[#FF6B00] focus:outline-none bg-white"
            >
              <option value="relevance">Pertinence</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix décroissant</option>
              <option value="popular">Popularité</option>
              <option value="recent">Plus récents</option>
            </select>
          </div>
        </div>

        <div className="grid lg:grid-cols-[260px_1fr] gap-6">
          <aside className="hidden lg:block bg-white border border-gray-100 rounded-2xl p-5 h-fit sticky top-24">
            {FiltersPanel}
          </aside>

          <section>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
                {error}
                <p className="mt-2 text-xs">
                  Astuce : exécutez le seed SQL{' '}
                  <code className="bg-red-100 px-1 rounded">003_seed_demo_catalog.sql</code> dans
                  Supabase.
                </p>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-72 bg-white rounded-2xl animate-pulse border" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <p className="font-bold text-[#1F2937] mb-2">Aucun produit trouvé</p>
                <p className="text-sm text-gray-500 mb-4">
                  Modifiez vos filtres ou lancez le seed de démo dans Supabase.
                </p>
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-[#FF6B00] text-white rounded-xl text-sm font-bold"
                >
                  Effacer les filtres
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
                  {products.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <button
                      disabled={page <= 1}
                      onClick={() => updateParam('page', String(page - 1))}
                      className="px-4 py-2 border-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                    >
                      Précédent
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {page} / {totalPages}
                    </span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => updateParam('page', String(page + 1))}
                      className="px-4 py-2 border-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                    >
                      Suivant
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>
      <Footer />

      {mobileFilters && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFilters(false)} />
          <div className="absolute right-0 top-0 h-full w-[85%] max-w-sm bg-white p-5 overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold text-lg">Filtres</h2>
              <button onClick={() => setMobileFilters(false)}>
                <X size={22} />
              </button>
            </div>
            {FiltersPanel}
          </div>
        </div>
      )}
    </div>
  );
}
