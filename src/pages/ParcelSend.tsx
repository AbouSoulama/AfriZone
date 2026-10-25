import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CheckCircle, MapPin, Navigation, Package, Search } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { useCountry } from '../context/CountryContext';
import { formatPrice } from '../services/catalog';
import { fetchDefaultAddress } from '../services/account';
import {
  citiesForParcelCountry,
  createParcel,
  defaultParcelCity,
  PARCEL_RATE_PER_KG,
  PARCEL_TYPE_LABELS,
  quoteParcel,
  type ParcelType,
} from '../services/parcels';
import PaymentMethodPicker from '../components/PaymentMethodPicker';
import { paymentMethodById, paymentMethodLabel, paymentMethodsForCountry } from '../data/country-payments';
import { isPaymentTestMode, startCheckout, TEST_PAYMENT_HINT } from '../services/payments';
import { countryCodeFromLabelOrCity, countryLabel } from '../types/catalog';

type GpsTarget = 'pickup' | 'delivery';

export default function ParcelSendPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { country: siteCountry, countryName } = useCountry();
  const cities = citiesForParcelCountry(siteCountry);
  const defaultCity = defaultParcelCity(siteCountry);

  const [senderName, setSenderName] = useState(user?.fullName || '');
  const [senderPhone, setSenderPhone] = useState(user?.phone || '');
  const [payPhone, setPayPhone] = useState(user?.phone || '');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupCity, setPickupCity] = useState(defaultCity);
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [pickupManualLat, setPickupManualLat] = useState('');
  const [pickupManualLng, setPickupManualLng] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCity, setDeliveryCity] = useState(defaultCity);
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [deliveryManualLat, setDeliveryManualLat] = useState('');
  const [deliveryManualLng, setDeliveryManualLng] = useState('');
  const [parcelType, setParcelType] = useState<ParcelType>('standard');
  const [weightKg, setWeightKg] = useState(1);
  const [contentDescription, setContentDescription] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState<GpsTarget | null>(null);
  const [geoHint, setGeoHint] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [tracking, setTracking] = useState<string | null>(null);

  // Quand le pays du site change, restreindre les villes.
  useEffect(() => {
    const list = citiesForParcelCountry(siteCountry);
    const capital = defaultParcelCity(siteCountry);
    setPickupCity((prev) => (list.includes(prev) ? prev : capital));
    setDeliveryCity((prev) => (list.includes(prev) ? prev : capital));
  }, [siteCountry]);

  useEffect(() => {
    const methods = paymentMethodsForCountry(siteCountry);
    setPaymentMethod((current) =>
      methods.some((m) => m.id === current) ? current : methods[0]?.id || ''
    );
  }, [siteCountry]);

  useEffect(() => {
    if (!user) return;
    const countryCities = citiesForParcelCountry(siteCountry);
    setSenderName(user.fullName || '');
    setSenderPhone(user.phone || '');
    setPayPhone(user.phone || '');
    const userCityCountry = countryCodeFromLabelOrCity(user.city);
    if (user.city && userCityCountry === siteCountry && countryCities.includes(user.city)) {
      setPickupCity(user.city);
    }
    fetchDefaultAddress(user.id)
      .then((def) => {
        if (!def) return;
        setSenderName(def.fullName);
        setSenderPhone(def.phone);
        setPayPhone(def.phone);
        setPickupAddress(def.address);
        const defCountry = countryCodeFromLabelOrCity(def.city);
        if (defCountry === siteCountry && countryCities.includes(def.city)) {
          setPickupCity(def.city);
        }
        if (def.lat != null && def.lng != null) {
          setPickupLat(def.lat);
          setPickupLng(def.lng);
          setPickupManualLat(String(def.lat));
          setPickupManualLng(String(def.lng));
        }
      })
      .catch(() => undefined);
  }, [user, siteCountry]);

  const quote = useMemo(
    () =>
      quoteParcel({
        weightKg,
        pickupCity,
        deliveryCity,
        parcelType,
        pickupLat,
        pickupLng,
        deliveryLat,
        deliveryLng,
      }),
    [
      weightKg,
      pickupCity,
      deliveryCity,
      parcelType,
      pickupLat,
      pickupLng,
      deliveryLat,
      deliveryLng,
    ]
  );

  const syncManual = (
    target: GpsTarget,
    latStr: string,
    lngStr: string
  ) => {
    const setManualLat = target === 'pickup' ? setPickupManualLat : setDeliveryManualLat;
    const setManualLng = target === 'pickup' ? setPickupManualLng : setDeliveryManualLng;
    const setLat = target === 'pickup' ? setPickupLat : setDeliveryLat;
    const setLng = target === 'pickup' ? setPickupLng : setDeliveryLng;

    setManualLat(latStr);
    setManualLng(lngStr);
    if (!latStr.trim() && !lngStr.trim()) {
      setLat(null);
      setLng(null);
      setGeoHint(null);
      return;
    }
    const lat = Number(latStr.replace(',', '.'));
    const lng = Number(lngStr.replace(',', '.'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setGeoHint('Saisissez des nombres valides pour latitude et longitude.');
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setGeoHint('Coordonnées hors plage (lat −90…90, lng −180…180).');
      return;
    }
    setLat(lat);
    setLng(lng);
    setGeoHint(null);
  };

  const captureLocation = (target: GpsTarget) => {
    if (!navigator.geolocation) {
      setGeoHint('La géolocalisation n’est pas disponible sur cet appareil.');
      return;
    }
    setGeoLoading(target);
    setGeoHint(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (target === 'pickup') {
          setPickupLat(lat);
          setPickupLng(lng);
          setPickupManualLat(String(lat));
          setPickupManualLng(String(lng));
        } else {
          setDeliveryLat(lat);
          setDeliveryLng(lng);
          setDeliveryManualLat(String(lat));
          setDeliveryManualLng(String(lng));
        }
        setGeoLoading(null);
        setGeoHint(
          target === 'pickup'
            ? 'Position d’enlèvement enregistrée.'
            : 'Position de livraison enregistrée.'
        );
      },
      (err) => {
        setGeoLoading(null);
        setGeoHint(
          err.code === 1
            ? 'Autorisation GPS refusée. Activez la localisation ou saisissez les coordonnées.'
            : 'Impossible d’obtenir la position. Réessayez ou saisissez manuellement.'
        );
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const clearLocation = (target: GpsTarget) => {
    if (target === 'pickup') {
      setPickupLat(null);
      setPickupLng(null);
      setPickupManualLat('');
      setPickupManualLng('');
    } else {
      setDeliveryLat(null);
      setDeliveryLng(null);
      setDeliveryManualLat('');
      setDeliveryManualLng('');
    }
    setGeoHint(null);
  };

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
            <p className="text-gray-500 text-sm mb-2">
              Envoi payé via {paymentMethodLabel(paymentMethod)}
              {lastTx ? ` · réf. ${lastTx}` : ''}.
              {isPaymentTestMode() ? ' Mode test — aucun débit réel.' : ''}
            </p>
            <p className="font-mono font-bold text-[#FF6B00] text-lg mb-6">{tracking}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => navigate(`/colis/${doneId}`)}
                className="py-3 bg-[#FF6B00] text-white rounded-xl font-bold"
              >
                Voir mon envoi
              </button>
              <Link
                to={`/suivi?n=${encodeURIComponent(tracking)}`}
                className="py-3 text-sm font-semibold text-gray-600"
              >
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
      if (!paymentMethod) throw new Error('Choisissez un moyen de paiement.');
      const paidWith = payPhone.trim() || senderPhone.trim();
      if (paidWith.replace(/\D/g, '').length < 8) {
        throw new Error('Indiquez le numéro Mobile Money utilisé pour payer.');
      }
      const checkout = await startCheckout({
        amount: quote.totalXof,
        phone: paidWith,
        provider: paymentMethod,
        kind: 'parcel',
        customerName: senderName || user.fullName,
        customerEmail: user.email,
        country: siteCountry,
      });
      const parcel = await createParcel(user.id, {
        senderName,
        senderPhone,
        pickupAddress,
        pickupCity,
        pickupLat,
        pickupLng,
        recipientName,
        recipientPhone,
        deliveryAddress,
        deliveryCity,
        deliveryLat,
        deliveryLng,
        parcelType,
        weightKg,
        contentDescription,
        specialInstructions,
        paymentPhone: paidWith,
        paymentMethod,
        paymentTransactionId: checkout.transactionId,
        markPaid: true,
      });

      setLastTx(checkout.transactionId);
      setDoneId(parcel.id);
      setTracking(parcel.trackingNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const renderGpsBlock = (
    target: GpsTarget,
    lat: number | null,
    lng: number | null,
    manualLat: string,
    manualLng: string,
    title: string,
    hint: string
  ) => (
    <div className="rounded-2xl border-2 border-dashed border-[#00A651]/40 bg-[#00A651]/5 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-[#00A651] text-white p-2">
          <Navigation size={18} />
        </div>
        <div className="flex-1">
          <p className="font-extrabold text-sm">{title}</p>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{hint}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => captureLocation(target)}
          disabled={geoLoading === target}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#00A651] text-white rounded-xl text-sm font-bold disabled:opacity-60"
        >
          <MapPin size={16} />
          {geoLoading === target ? 'Localisation…' : 'Utiliser ma position'}
        </button>
        {lat != null && lng != null && (
          <button
            type="button"
            onClick={() => clearLocation(target)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-600"
          >
            Effacer
          </button>
        )}
      </div>
      <div className="pt-1">
        <p className="text-xs font-bold text-gray-700 mb-2">Ou saisie manuelle</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Latitude</label>
            <input
              type="text"
              inputMode="decimal"
              value={manualLat}
              onChange={(e) => syncManual(target, e.target.value, manualLng)}
              placeholder="ex. 12.37140"
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-[#00A651] focus:outline-none bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Longitude</label>
            <input
              type="text"
              inputMode="decimal"
              value={manualLng}
              onChange={(e) => syncManual(target, manualLat, e.target.value)}
              placeholder="ex. -1.51966"
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-[#00A651] focus:outline-none bg-white"
            />
          </div>
        </div>
      </div>
      {lat != null && lng != null ? (
        <p className="text-xs font-semibold text-[#00A651]">
          ✓ GPS enregistré : {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
      ) : (
        <p className="text-xs text-amber-700 font-medium">
          Recommandé : sans GPS, le livreur utilisera seulement la ville / l’adresse.
        </p>
      )}
    </div>
  );

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
              {countryName} — villes du pays sélectionné · tarif au kg · paiement Mobile Money.
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

        <form onSubmit={onSubmit} className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-6">
            <section className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
              <h2 className="font-extrabold">Expéditeur & enlèvement</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Nom complet *</label>
                  <input
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    required
                    placeholder="Prénom et nom"
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
                <label className="block text-sm font-bold mb-2">
                  Ville d&apos;enlèvement *{' '}
                  <span className="font-normal text-gray-400">({countryLabel(siteCountry)})</span>
                </label>
                <select
                  value={pickupCity}
                  onChange={(e) => setPickupCity(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white"
                >
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              {renderGpsBlock(
                'pickup',
                pickupLat,
                pickupLng,
                pickupManualLat,
                pickupManualLng,
                'GPS point d’enlèvement',
                'Partagez la position exacte où le coursier doit récupérer le colis.'
              )}
            </section>

            <section className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
              <h2 className="font-extrabold">Destinataire & livraison</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Nom complet *</label>
                  <input
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    required
                    placeholder="Prénom et nom du destinataire"
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
                  placeholder="Quartier, rue, repère..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">
                  Ville de livraison *{' '}
                  <span className="font-normal text-gray-400">({countryLabel(siteCountry)})</span>
                </label>
                <select
                  value={deliveryCity}
                  onChange={(e) => setDeliveryCity(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white"
                >
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              {renderGpsBlock(
                'delivery',
                deliveryLat,
                deliveryLng,
                deliveryManualLat,
                deliveryManualLng,
                'GPS point de livraison',
                'Indiquez la position précise de remise au destinataire (Maps / suivi livreur).'
              )}
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
              <div className="rounded-2xl border border-[#FF6B00]/30 bg-orange-50/60 p-4 space-y-3">
                <h3 className="font-extrabold">Paiement</h3>
                <PaymentMethodPicker
                  country={siteCountry}
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                />
                <div>
                  <label className="block text-sm font-bold mb-2">
                    Numéro {paymentMethodLabel(paymentMethod)}
                  </label>
                  <input
                    value={payPhone}
                    onChange={(e) => setPayPhone(e.target.value)}
                    placeholder={`${paymentMethodById(paymentMethod)?.dial || ''} …`}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none bg-white"
                  />
                </div>
                {isPaymentTestMode() ? (
                  <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3 leading-relaxed">
                    {TEST_PAYMENT_HINT}
                  </p>
                ) : (
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Vous allez recevoir une demande de confirmation sur votre téléphone.
                  </p>
                )}
              </div>
              {geoHint && (
                <p className="text-xs text-gray-600 bg-gray-50 border rounded-xl px-3 py-2">{geoHint}</p>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                  {error}
                </div>
              )}
            </section>
          </div>

          <aside className="bg-white border border-gray-100 rounded-2xl p-5 h-fit lg:sticky lg:top-24">
            <h2 className="font-extrabold mb-1">Estimation</h2>
            <p className="text-xs text-gray-500 mb-4">
              Tarif = prise en charge + kg × {PARCEL_RATE_PER_KG} FCFA + type
            </p>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Trajet</span>
                <span className="font-semibold text-right">
                  {pickupCity} → {deliveryCity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">
                  Prise en charge ({quote.sameCity ? 'même ville' : 'interville'})
                </span>
                <span>{formatPrice(quote.baseXof)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">
                  Poids ({quote.billedKg} kg × {PARCEL_RATE_PER_KG})
                </span>
                <span>{formatPrice(quote.weightXof)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Type ({PARCEL_TYPE_LABELS[parcelType]})</span>
                <span>{formatPrice(quote.typeXof)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold border-t pt-3">
                <span>Total</span>
                <span className="text-[#FF6B00]">{formatPrice(quote.totalXof)}</span>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mb-4 leading-relaxed">
              Le GPS aide le livreur à vous retrouver ; il n’entre pas dans le prix.
            </p>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#00A651] hover:bg-[#008A43] disabled:bg-gray-300 text-white rounded-xl font-bold"
            >
              {loading
                ? isPaymentTestMode()
                  ? 'Simulation du paiement...'
                  : 'Paiement...'
                : isPaymentTestMode()
                  ? `Tester le paiement · ${formatPrice(quote.totalXof)}`
                  : `Payer ${formatPrice(quote.totalXof)}`}
            </button>
          </aside>
        </form>
      </main>
      <Footer />
    </div>
  );
}
