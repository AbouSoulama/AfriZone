import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../services/catalog';
import { placeOrders, type PaymentMethod } from '../services/orders';
import { CATALOG_CITIES } from '../types/catalog';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { summary, refreshCart } = useCart();
  const [address, setAddress] = useState('');
  const [city, setCity] = useState(user?.city || 'Dakar');
  const [phone, setPhone] = useState(user?.phone || '');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [doneIds, setDoneIds] = useState<string[] | null>(null);

  if (!authLoading && !isAuthenticated) {
    return <Navigate to="/auth/login" replace state={{ from: '/checkout' }} />;
  }

  if (!summary?.items.length && !doneIds) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-xl mx-auto px-4 py-16 text-center">
          <p className="text-gray-600 mb-4">Panier vide.</p>
          <Link to="/catalogue" className="text-[#FF6B00] font-bold">
            Voir le catalogue
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  if (doneIds) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="bg-white border rounded-2xl p-8">
            <CheckCircle size={48} className="mx-auto text-[#00A651] mb-4" />
            <h1 className="text-2xl font-extrabold mb-2">Commande enregistrée</h1>
            <p className="text-gray-500 text-sm mb-6">
              {doneIds.length > 1
                ? `${doneIds.length} commandes créées (un ticket par vendeur).`
                : 'Votre commande a été créée avec succès.'}{' '}
              Paiement :{' '}
              {paymentMethod === 'cash'
                ? 'Cash à la livraison'
                : paymentMethod === 'orange_money'
                  ? 'Orange Money (bientôt)'
                  : 'Wave (bientôt)'}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => navigate('/commandes')}
                className="py-3 bg-[#FF6B00] text-white rounded-xl font-bold"
              >
                Voir mes commandes
              </button>
              <Link to="/" className="py-3 text-sm font-semibold text-gray-600">
                Retour à l&apos;accueil
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const ids = await placeOrders(user.id, {
        shippingAddress: address,
        shippingCity: city,
        shippingPhone: phone,
        notes,
        paymentMethod,
      });
      await refreshCart();
      setDoneIds(ids);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur commande');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl md:text-3xl font-extrabold mb-6">Checkout</h1>
        <form onSubmit={onSubmit} className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
            <h2 className="font-extrabold">Adresse de livraison</h2>
            <div>
              <label className="block text-sm font-bold mb-2">Adresse *</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                placeholder="Quartier, rue, repère..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">Ville *</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white"
                >
                  {CATALOG_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Téléphone *</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="+221 ..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Instructions (optionnel)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl resize-none focus:border-[#FF6B00] focus:outline-none"
              />
            </div>

            <div>
              <h2 className="font-extrabold mb-3">Mode de paiement</h2>
              <div className="space-y-2">
                {(
                  [
                    { id: 'cash', label: 'Cash à la livraison', hint: 'Disponible maintenant' },
                    { id: 'orange_money', label: 'Orange Money', hint: 'Bientôt' },
                    { id: 'wave', label: 'Wave', hint: 'Bientôt' },
                  ] as const
                ).map((m) => (
                  <label
                    key={m.id}
                    className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer ${
                      paymentMethod === m.id
                        ? 'border-[#FF6B00] bg-orange-50'
                        : 'border-gray-200'
                    } ${m.id !== 'cash' ? 'opacity-60' : ''}`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="pay"
                        checked={paymentMethod === m.id}
                        disabled={m.id !== 'cash'}
                        onChange={() => setPaymentMethod(m.id)}
                        className="accent-[#FF6B00]"
                      />
                      <span className="font-semibold text-sm">{m.label}</span>
                    </span>
                    <span className="text-xs text-gray-500">{m.hint}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                {error}
              </div>
            )}
          </div>

          <aside className="bg-white border border-gray-100 rounded-2xl p-5 h-fit">
            <h2 className="font-extrabold mb-4">Récapitulatif</h2>
            <ul className="space-y-2 text-sm mb-4 max-h-48 overflow-y-auto">
              {summary?.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <span className="text-gray-600 truncate">
                    {i.quantity}× {i.product.name}
                  </span>
                  <span className="font-semibold shrink-0">
                    {formatPrice(i.product.price * i.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="space-y-2 text-sm border-t pt-3 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Sous-total</span>
                <span>{formatPrice(summary?.subtotal ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Livraison</span>
                <span>{formatPrice(summary?.shippingEstimate ?? 0)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold">
                <span>Total</span>
                <span className="text-[#FF6B00]">{formatPrice(summary?.total ?? 0)}</span>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#00A651] hover:bg-[#008A43] disabled:bg-gray-300 text-white rounded-xl font-bold"
            >
              {loading ? 'Validation...' : 'Confirmer la commande'}
            </button>
          </aside>
        </form>
      </main>
      <Footer />
    </div>
  );
}
