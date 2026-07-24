import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CheckCircle, Package, Search } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../services/catalog';
import { fetchDefaultAddress } from '../services/account';
import {
  createParcel,
  estimateParcelPrice,
  PARCEL_CITIES,
  PARCEL_TYPE_LABELS,
  type ParcelType,
} from '../services/parcels';

export default function ParcelSendPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [senderName, setSenderName] = useState(user?.fullName || '');
  const [senderPhone, setSenderPhone] = useState(user?.phone || '');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupCity, setPickupCity] = useState(user?.city || 'Dakar');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('Ouagadougou');
  const [parcelType, setParcelType] = useState<ParcelType>('standard');
  const [weightKg, setWeightKg] = useState(1);
  const [contentDescription, setContentDescription] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentPhone, setPaymentPhone] = useState(user?.phone || '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [tracking, setTracking] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setSenderName(user.fullName || '');
    setSenderPhone(user.phone || '');
    setPaymentPhone(user.phone || '');
    if (user.city) setPickupCity(user.city);
    fetchDefaultAddress(user.id)
      .then((def) => {
        if (!def) return;
        setSenderName(def.fullName);
        setSenderPhone(def.phone);
        setPickupAddress(def.address);
        setPickupCity(def.city);
      })
      .catch(() => undefined);
  }, [user]);

  const price = useMemo(
    () => estimateParcelPrice(weightKg, pickupCity, deliveryCity, parcelType),
    [weightKg, pickupCity, deliveryCity, parcelType]
  );

  if (!authLoading && !isAuthenticated) {
    return <Navigate to="/auth/login" replace state={{ from: '/colis' }} />;
  }

  if (doneId && tracking) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="bg-white border rounded-2xl p-8">
            <CheckCircle size={48} className="mx-auto text-[#00A651] mb-4" />
            <h1 className="text-2xl font-extrabold mb-2">Colis enregistré</h1>
            <p className="text-gray-500 text-sm mb-2">Paiement Mobile Money confirmé.</p>
            <p className="font-mono font-bold text-[#FF6B00] text-lg mb-6">{tracking}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => navigate(`/colis/${doneId}`)}
                className="py-3 bg-[#FF6B00] text-white rounded-xl font-bold"
              >
                Voir mon envoi
              </button>
              <Link to={`/suivi?n=${encodeURIComponent(tracking)}`} className="py-3 text-sm font-semibold text-gray-600">
                Page de suivi public
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
      const parcel = await createParcel(user.id, {
        senderName,
        senderPhone,
        pickupAddress,
        pickupCity,
        recipientName,
        recipientPhone,
        deliveryAddress,
        deliveryCity,
        parcelType,
        weightKg,
        contentDescription,
        specialInstructions,
        paymentPhone,
      });
      setDoneId(parcel.id);
      setTracking(parcel.trackingNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 text-[#00A651] text-xs font-bold mb-2">
              <Package size={14} /> ENVOI DE COLIS
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold">Envoyer un colis</h1>
            <p className="text-sm text-gray-500 mt-1">
              Dakar · Ouagadougou · Bamako — paiement Mobile Money immédiat.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/suivi"
              className="inline-flex items-center gap-2 px-4 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold hover:border-[#FF6B00]"
            >
              <Search size={16} /> Suivre un colis
            </Link>
            <Link
              to="/colis/mes-envois"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1F2937] text-white rounded-xl text-sm font-semibold"
            >
              Mes envois
            </Link>
          </div>
        </div>

        <form onSubmit={onSubmit} className="grid lg:grid-cols-[1fr_300px] gap-6">
          <div className="space-y-6">
            <section className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
              <h2 className="font-extrabold">Expéditeur & enlèvement</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Nom *</label>
                  <input
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Téléphone *</label>
                  <input
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Adresse d&apos;enlèvement *</label>
                <input
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  required
                  placeholder="Quartier, rue, repère..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Ville d&apos;enlèvement *</label>
                <select
                  value={pickupCity}
                  onChange={(e) => setPickupCity(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white"
                >
                  {PARCEL_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
              <h2 className="font-extrabold">Destinataire & livraison</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Nom *</label>
                  <input
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Téléphone *</label>
                  <input
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Adresse de livraison *</label>
                <input
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Ville de livraison *</label>
                <select
                  value={deliveryCity}
                  onChange={(e) => setDeliveryCity(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white"
                >
                  {PARCEL_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
              <h2 className="font-extrabold">Détails du colis</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Type *</label>
                  <select
                    value={parcelType}
                    onChange={(e) => setParcelType(e.target.value as ParcelType)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white"
                  >
                    {(Object.keys(PARCEL_TYPE_LABELS) as ParcelType[]).map((t) => (
                      <option key={t} value={t}>
                        {PARCEL_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Poids (kg) *</label>
                  <input
                    type="number"
                    min={0.1}
                    max={50}
                    step={0.1}
                    value={weightKg}
                    onChange={(e) => setWeightKg(Number(e.target.value))}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Contenu *</label>
                <textarea
                  value={contentDescription}
                  onChange={(e) => setContentDescription(e.target.value)}
                  required
                  rows={3}
                  placeholder="Ex. : vêtements, documents administratifs..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl resize-none focus:border-[#FF6B00] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Instructions (optionnel)</label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl resize-none focus:border-[#FF6B00] focus:outline-none"
                />
              </div>
              <div>
                <h3 className="font-extrabold mb-2">Paiement</h3>
                <div className="p-4 border-2 border-[#FF6B00] bg-orange-50 rounded-xl mb-3">
                  <p className="font-semibold text-sm">Mobile Money</p>
                  <p className="text-xs text-gray-500">Paiement immédiat</p>
                </div>
                <label className="block text-sm font-bold mb-2">Numéro Mobile Money *</label>
                <input
                  value={paymentPhone}
                  onChange={(e) => setPaymentPhone(e.target.value)}
                  required
                  placeholder="+221 77 ..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                  {error}
                </div>
              )}
            </section>
          </div>

          <aside className="bg-white border border-gray-100 rounded-2xl p-5 h-fit lg:sticky lg:top-24">
            <h2 className="font-extrabold mb-4">Estimation</h2>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Trajet</span>
                <span className="font-semibold text-right">
                  {pickupCity} → {deliveryCity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span>{PARCEL_TYPE_LABELS[parcelType]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Poids</span>
                <span>{weightKg} kg</span>
              </div>
              <div className="flex justify-between text-base font-extrabold border-t pt-3">
                <span>Total</span>
                <span className="text-[#FF6B00]">{formatPrice(price)}</span>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#00A651] hover:bg-[#008A43] disabled:bg-gray-300 text-white rounded-xl font-bold"
            >
              {loading ? 'Paiement...' : `Payer ${formatPrice(price)}`}
            </button>
          </aside>
        </form>
      </main>
      <Footer />
    </div>
  );
}
