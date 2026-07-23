import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../services/catalog';
import { estimateItemShipping } from '../services/cart';

export default function CartPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { summary, isLoading, setQuantity, removeItem } = useCart();

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-16 text-center">
          <ShoppingBag size={48} className="mx-auto text-gray-300 mb-4" />
          <h1 className="text-2xl font-extrabold mb-2">Votre panier</h1>
          <p className="text-gray-500 mb-6">Connectez-vous pour voir et gérer votre panier.</p>
          <Link
            to="/auth/login"
            state={{ from: '/panier' }}
            className="inline-flex px-6 py-3 bg-[#FF6B00] text-white rounded-xl font-bold"
          >
            Se connecter
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const items = summary?.items ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#1F2937] mb-6">Panier</h1>

        {isLoading ? (
          <div className="h-40 bg-white rounded-2xl border animate-pulse" />
        ) : items.length === 0 ? (
          <div className="bg-white border rounded-2xl p-10 text-center">
            <ShoppingBag size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 mb-4">Votre panier est vide.</p>
            <Link to="/catalogue" className="text-[#FF6B00] font-bold">
              Continuer les achats
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_320px] gap-6">
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-gray-100 rounded-2xl p-4 flex gap-4"
                >
                  <Link to={`/produit/${item.product.slug}`} className="shrink-0">
                    <img
                      src={
                        item.product.mainImage ||
                        item.product.images[0] ||
                        'https://images.unsplash.com/photo-1560393464-5c69a73c5770?w=160&h=160&fit=crop'
                      }
                      alt=""
                      className="w-24 h-24 rounded-xl object-cover"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/produit/${item.product.slug}`}
                      className="font-bold text-[#1F2937] hover:text-[#FF6B00] line-clamp-2"
                    >
                      {item.product.name}
                    </Link>
                    <p className="text-xs text-gray-500 mt-1">
                      {item.product.vendor?.shopName} ·{' '}
                      {item.product.deliveryMode === 'afrizone'
                        ? 'Livré par AfriZone'
                        : 'Livré par le vendeur'}
                    </p>
                    <p className="text-sm font-extrabold text-[#FF6B00] mt-2">
                      {formatPrice(item.product.price)}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      Livraison estimée : {formatPrice(estimateItemShipping(item.product))}
                    </p>

                    <div className="flex items-center gap-3 mt-3">
                      <div className="inline-flex items-center border-2 border-gray-200 rounded-xl">
                        <button
                          onClick={() => setQuantity(item.id, item.quantity - 1)}
                          className="p-2 hover:bg-gray-50"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="px-3 text-sm font-bold">{item.quantity}</span>
                        <button
                          onClick={() =>
                            setQuantity(
                              item.id,
                              Math.min(item.product.stock, item.quantity + 1)
                            )
                          }
                          className="p-2 hover:bg-gray-50"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="font-extrabold text-[#1F2937]">
                      {formatPrice(item.product.price * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <aside className="bg-white border border-gray-100 rounded-2xl p-5 h-fit sticky top-24">
              <h2 className="font-extrabold mb-4">Résumé</h2>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">Sous-total</span>
                  <span className="font-semibold">{formatPrice(summary?.subtotal ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Livraison estimée</span>
                  <span className="font-semibold">
                    {formatPrice(summary?.shippingEstimate ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t text-base">
                  <span className="font-bold">Total</span>
                  <span className="font-extrabold text-[#FF6B00]">
                    {formatPrice(summary?.total ?? 0)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => navigate('/checkout')}
                className="w-full py-3.5 bg-[#FF6B00] hover:bg-[#E05E00] text-white rounded-xl font-bold mb-3"
              >
                Passer la commande
              </button>
              <Link
                to="/catalogue"
                className="block text-center text-sm font-semibold text-gray-600 hover:text-[#FF6B00]"
              >
                Continuer les achats
              </Link>
            </aside>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
