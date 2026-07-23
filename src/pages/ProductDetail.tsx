import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  MapPin,
  Package,
  ShoppingCart,
  Star,
  Store,
  Truck,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { fetchProductBySlug, formatPrice } from '../services/catalog';
import type { CatalogProduct } from '../types/catalog';

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [cartMsg, setCartMsg] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    fetchProductBySlug(slug)
      .then((p) => {
        if (cancelled) return;
        setProduct(p);
        if (!p) setError('Produit introuvable');
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const images =
    product?.images?.length
      ? product.images
      : product?.mainImage
        ? [product.mainImage]
        : [];

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

        {loading && (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="h-96 bg-white rounded-2xl animate-pulse" />
            <div className="h-96 bg-white rounded-2xl animate-pulse" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">{error}</div>
        )}

        {!loading && product && (
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            <div>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-3">
                <img
                  src={
                    images[activeImage] ||
                    'https://images.unsplash.com/photo-1560393464-5c69a73c5770?w=800&h=800&fit=crop'
                  }
                  alt={product.name}
                  className="w-full aspect-square object-cover"
                />
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {images.map((img, i) => (
                    <button
                      key={img + i}
                      onClick={() => setActiveImage(i)}
                      className={`w-20 h-20 rounded-xl overflow-hidden border-2 shrink-0 ${
                        i === activeImage ? 'border-[#FF6B00]' : 'border-gray-200'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-sm text-[#FF6B00] font-semibold mb-2">{product.category}</p>
              <h1 className="text-2xl md:text-3xl font-extrabold text-[#1F2937] mb-3">
                {product.name}
              </h1>

              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={16}
                      className={
                        s <= Math.round(product.rating)
                          ? 'text-[#FFD700] fill-[#FFD700]'
                          : 'text-gray-200'
                      }
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-500">
                  {product.rating.toFixed(1)} ({product.reviewCount} avis)
                </span>
                <span className="text-sm text-gray-400">· {product.soldCount} vendus</span>
              </div>

              <div className="mb-6">
                <p className="text-3xl font-extrabold text-[#FF6B00]">
                  {formatPrice(product.price, product.currency)}
                </p>
                {product.oldPrice != null && (
                  <p className="text-sm text-gray-400 line-through">
                    {formatPrice(product.oldPrice, product.currency)}
                  </p>
                )}
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Package size={16} className="text-[#FF6B00]" />
                  <span>
                    État : <strong className="capitalize">{product.condition}</strong>
                  </span>
                  <span className="text-gray-300">·</span>
                  <span>
                    Stock : <strong>{product.stock}</strong>
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <Truck size={16} className="text-[#00A651] mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      {product.deliveryMode === 'afrizone'
                        ? 'Livré par AfriZone'
                        : 'Livré par le vendeur'}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {product.deliveryMode === 'afrizone'
                        ? 'Frais calculés automatiquement selon la zone'
                        : product.vendorDeliveryFee != null
                          ? `Frais vendeur : ${formatPrice(product.vendorDeliveryFee)}`
                          : 'Frais selon zone du vendeur'}
                    </p>
                  </div>
                </div>
              </div>

              {product.vendor && (
                <Link
                  to={`/boutique/${product.vendor.shopSlug}`}
                  className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4 mb-6 hover:border-[#00A651] transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                    {product.vendor.shopLogoUrl ? (
                      <img
                        src={product.vendor.shopLogoUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Store size={20} className="text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[#1F2937] truncate">{product.vendor.shopName}</p>
                      <CheckCircle size={14} className="text-[#00A651] shrink-0" />
                    </div>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin size={12} /> {product.vendor.city} · {product.vendor.vendorCode}
                    </p>
                  </div>
                </Link>
              )}

              <div className="flex flex-wrap gap-3 mb-6">
                <button
                  disabled={adding || product.stock <= 0}
                  onClick={async () => {
                    if (!isAuthenticated) {
                      navigate('/auth/login', { state: { from: `/produit/${slug}` } });
                      return;
                    }
                    setAdding(true);
                    setCartMsg(null);
                    try {
                      await addItem(product.id, 1);
                      setCartMsg('Ajouté au panier.');
                      setTimeout(() => setCartMsg(null), 3000);
                    } catch (e) {
                      setCartMsg(e instanceof Error ? e.message : 'Erreur panier');
                    } finally {
                      setAdding(false);
                    }
                  }}
                  className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-2 py-3.5 bg-[#FF6B00] hover:bg-[#E05E00] text-white rounded-xl font-bold disabled:opacity-50"
                >
                  <ShoppingCart size={18} /> {adding ? 'Ajout...' : 'Ajouter au panier'}
                </button>
                <button
                  disabled={adding || product.stock <= 0}
                  onClick={async () => {
                    if (!isAuthenticated) {
                      navigate('/auth/login', { state: { from: `/produit/${slug}` } });
                      return;
                    }
                    setAdding(true);
                    setCartMsg(null);
                    try {
                      await addItem(product.id, 1);
                      navigate('/checkout');
                    } catch (e) {
                      setCartMsg(e instanceof Error ? e.message : 'Erreur panier');
                      setAdding(false);
                    }
                  }}
                  className="flex-1 min-w-[160px] py-3.5 bg-[#00A651] hover:bg-[#008A43] text-white rounded-xl font-bold disabled:opacity-50"
                >
                  Acheter maintenant
                </button>
              </div>
              {cartMsg && (
                <p
                  className={`text-sm mb-4 ${
                    cartMsg.includes('Ajouté') ? 'text-green-700' : 'text-amber-700'
                  }`}
                >
                  {cartMsg}
                </p>
              )}

              <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <h2 className="font-extrabold text-[#1F2937] mb-3">Description</h2>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {product.description || 'Aucune description fournie.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
