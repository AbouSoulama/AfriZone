import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../services/catalog';
import { placeOrders } from '../services/orders';
import { fetchDefaultAddress, fetchMyAddresses, type AddressView } from '../services/account';
import {
  chargeMobileMoney,
  MOBILE_MONEY_OPERATORS,
  PAYMENT_CHANNELS,
  providerLabel,
  type MobileMoneyOperator,
  type MobileMoneyProvider,
  type PaymentChannel,
} from '../services/payments';
import {
  CATALOG_COUNTRIES,
  CITIES_BY_COUNTRY,
  capitalForCountry,
  countryCodeFromLabelOrCity,
  type CatalogCountryCode,
} from '../types/catalog';
import { useCountry } from '../context/CountryContext';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { summary, refreshCart } = useCart();
  const { country: siteCountry } = useCountry();
  const [addresses, setAddresses] = useState<AddressView[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [address, setAddress] = useState('');
  const [shipCountry, setShipCountry] = useState<CatalogCountryCode>(siteCountry || 'SN');
  const [city, setCity] = useState(() => capitalForCountry(siteCountry || 'SN'));
  const [phone, setPhone] = useState(user?.phone || '');
  const [notes, setNotes] = useState('');
  const [paymentPhone, setPaymentPhone] = useState(user?.phone || '');
  const [channel, setChannel] = useState<PaymentChannel>('mobile_money');
  const [operator, setOperator] = useState<MobileMoneyOperator>('orange_money');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [doneIds, setDoneIds] = useState<string[] | null>(null);

  const provider: MobileMoneyProvider = channel === 'wave' ? 'wave' : operator;

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const list = await fetchMyAddresses(user.id);
        setAddresses(list);
        const def = list.find((a) => a.isDefault) || list[0] || (await fetchDefaultAddress(user.id));
        if (def) {
          setSelectedAddressId(def.id);
          setAddress(def.address);
          const code =
            countryCodeFromLabelOrCity(def.country) ||
            countryCodeFromLabelOrCity(def.city) ||
            siteCountry;
          setShipCountry(code);
          setCity(def.city || capitalForCountry(code));
          setPhone(def.phone);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [user]);

  const applyAddress = (id: string) => {
    setSelectedAddressId(id);
    const a = addresses.find((x) => x.id === id);
    if (!a) return;
    setAddress(a.address);
    const code =
      countryCodeFromLabelOrCity(a.country) ||
      countryCodeFromLabelOrCity(a.city) ||
      shipCountry;
    setShipCountry(code);
    setCity(a.city || capitalForCountry(code));
    setPhone(a.phone);
  };

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
            <h1 className="text-2xl font-extrabold mb-2">Paiement confirmé</h1>
            <p className="text-gray-500 text-sm mb-6">
              {doneIds.length > 1
                ? `${doneIds.length} commandes créées (un ticket par vendeur).`
                : 'Votre commande a été payée et confirmée.'}{' '}
              Via {providerLabel(provider)}
              {paymentPhone ? ` (${paymentPhone})` : ''}.
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
      const charge = await chargeMobileMoney({
        amount: summary?.total ?? 0,
        phone: paymentPhone,
        provider,
      });

      const ids = await placeOrders(user.id, {
        shippingAddress: address,
        shippingCity: city,
        shippingPhone: phone,
        notes,
        paymentMethod: provider,
        paymentPhone,
        paymentTransactionId: charge.transactionId,
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
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-extrabold">Adresse de livraison</h2>
              <Link to="/compte/adresses" className="text-xs font-semibold text-[#FF6B00]">
                Gérer mes adresses
              </Link>
            </div>
            {addresses.length > 0 && (
              <div>
                <label className="block text-sm font-bold mb-2">Choisir une adresse enregistrée</label>
                <select
                  value={selectedAddressId}
                  onChange={(e) => applyAddress(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white"
                >
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {(a.label || 'Adresse') +
                        (a.isDefault ? ' ★' : '') +
                        ` — ${a.address}, ${a.city}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
                <label className="block text-sm font-bold mb-2">Pays *</label>
                <select
                  value={shipCountry}
                  onChange={(e) => {
                    const code = e.target.value as CatalogCountryCode;
                    setShipCountry(code);
                    setCity(capitalForCountry(code));
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white"
                >
                  {CATALOG_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Ville *</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white"
                >
                  {CITIES_BY_COUNTRY[shipCountry].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Téléphone livraison *</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="+221 ..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
              />
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
              <div className="grid sm:grid-cols-2 gap-2 mb-3">
                {PAYMENT_CHANNELS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChannel(c.id)}
                    className={`p-3 border-2 rounded-xl text-left transition-colors ${
                      channel === c.id
                        ? 'border-[#FF6B00] bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-semibold text-sm">{c.label}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{c.hint}</p>
                  </button>
                ))}
              </div>
              {channel === 'mobile_money' && (
                <div className="mb-4">
                  <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
                    Opérateur Mobile Money
                  </p>
                  <div className="grid sm:grid-cols-3 gap-2">
                    {MOBILE_MONEY_OPERATORS.map((op) => (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => setOperator(op.id)}
                        className={`p-3 border-2 rounded-xl text-left transition-colors ${
                          operator === op.id
                            ? 'border-[#FF6B00] bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="font-semibold text-sm">{op.label}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{op.hint}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-bold mb-2">
                  Numéro {providerLabel(provider)} *
                </label>
                <input
                  value={paymentPhone}
                  onChange={(e) => setPaymentPhone(e.target.value)}
                  required
                  placeholder="+221 77 ..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Vous recevrez une demande de confirmation sur ce numéro (simulation MVP ou API live).
                </p>
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
                <span>Total à payer</span>
                <span className="text-[#FF6B00]">{formatPrice(summary?.total ?? 0)}</span>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#00A651] hover:bg-[#008A43] disabled:bg-gray-300 text-white rounded-xl font-bold"
            >
              {loading
                ? 'Paiement en cours...'
                : `Payer ${formatPrice(summary?.total ?? 0)}`}
            </button>
          </aside>
        </form>
      </main>
      <Footer />
    </div>
  );
}
