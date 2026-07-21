import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, MapPin, Package, Star, Store } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProductCard from '../components/catalog/ProductCard';
import {
  fetchVendorBySlug,
  fetchVendorProducts,
} from '../services/catalog';
import type { CatalogProduct, CatalogVendor } from '../types/catalog';

export default function VendorShopPage() {
  const { slug } = useParams<{ slug: string }>();
  const [vendor, setVendor] = useState<CatalogVendor | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const v = await fetchVendorBySlug(slug);
        if (cancelled) return;
        if (!v) {
          setError('Boutique introuvable ou non validée');
          setVendor(null);
          setProducts([]);
          return;
        }
        setVendor(v);
        const list = await fetchVendorProducts(v.id);
        if (!cancelled) setProducts(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const categories = Array.from(new Set(products.map((p) => p.category)));
  const filtered = categoryFilter
    ? products.filter((p) => p.category === categoryFilter)
    : products;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Link
          to="/catalogue"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#FF6B00] mb-6"
        >
          <ArrowLeft size={16} /> Retour au catalogue
        </Link>

        {loading && <div className="h-48 bg-white rounded-2xl animate-pulse mb-6" />}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">{error}</div>
        )}

        {!loading && vendor && (
          <>
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-8">
              <div className="h-28 bg-gradient-to-r from-[#FF6B00] to-[#00A651]" />
              <div className="px-6 pb-6 -mt-10">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  <div className="w-24 h-24 rounded-2xl border-4 border-white bg-white shadow-lg overflow-hidden">
                    {vendor.shopLogoUrl ? (
                      <img
                        src={vendor.shopLogoUrl}
                        alt={vendor.shopName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-50">
                        <Store size={32} className="text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h1 className="text-2xl font-extrabold text-[#1F2937]">{vendor.shopName}</h1>
                      <span className="inline-flex items-center gap-1 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full text-[10px] font-bold text-[#00A651]">
                        <CheckCircle size={12} /> Vérifié
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 font-mono">{vendor.vendorCode}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <MapPin size={14} className="text-[#FF6B00]" /> {vendor.city},{' '}
                        {vendor.country}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star size={14} className="text-[#FFD700] fill-[#FFD700]" />{' '}
                        {vendor.rating.toFixed(1)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package size={14} /> {vendor.totalSales.toLocaleString('fr-FR')} ventes
                      </span>
                    </div>
                  </div>
                </div>
                {vendor.shopDescription && (
                  <p className="mt-4 text-sm text-gray-600 leading-relaxed max-w-3xl">
                    {vendor.shopDescription}
                  </p>
                )}
                {vendor.shopCategory && (
                  <p className="mt-2 text-xs font-semibold text-[#00A651]">
                    Catégorie : {vendor.shopCategory}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <h2 className="text-xl font-extrabold text-[#1F2937]">
                Produits <span className="text-[#FF6B00]">({filtered.length})</span>
              </h2>
              {categories.length > 1 && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:border-[#FF6B00] focus:outline-none"
                >
                  <option value="">Toutes les catégories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border p-10 text-center text-gray-500">
                Aucun produit actif dans cette boutique.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                {filtered.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
