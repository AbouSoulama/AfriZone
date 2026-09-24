import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Megaphone, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCountry } from '../../context/CountryContext';
import SubscriptionTermPicker from '../../components/SubscriptionTermPicker';
import {
  createAdPlacement,
  fetchActiveSubscription,
  fetchMyAds,
  fetchPlans,
  fetchSubscriptionTerms,
  formatPlanPrice,
  formatTermLabel,
  formatXof,
  quoteSubscription,
  setAdStatus,
  startSubscriptionCheckout,
  type ActiveSubscription,
  type AdPlacement,
  type AdSlot,
  type SubscriptionPlan,
  type SubscriptionTerm,
} from '../../services/subscriptions';

function vendorBenefits(plan: SubscriptionPlan): string[] {
  const f = plan.features;
  if (plan.code === 'vendor_pro') {
    return [
      'Badge Pro sur votre boutique',
      `Jusqu’à ${f.featuredProducts ?? 3} produits mis en avant`,
      'Priorité dans la liste vendeurs (accueil)',
      `Commission ${(Number(f.commissionPct ?? 0.1) * 100).toFixed(0)} %`,
    ];
  }
  if (plan.code === 'vendor_business') {
    return [
      'Tout Pro inclus',
      `Jusqu’à ${f.featuredProducts ?? 8} produits mis en avant`,
      '1 emplacement publicitaire (hero ou bandeau)',
      `Commission réduite ${(Number(f.commissionPct ?? 0.07) * 100).toFixed(0)} %`,
    ];
  }
  return ['Boutique active', 'Commission 10 %', 'Pas de mise en avant payante'];
}

export default function VendorSubscriptionPage() {
  const { user } = useAuth();
  const { country } = useCountry();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [terms, setTerms] = useState<SubscriptionTerm[]>([]);
  const [months, setMonths] = useState(1);
  const [active, setActive] = useState<ActiveSubscription | null>(null);
  const [ads, setAds] = useState<AdPlacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [adTitle, setAdTitle] = useState('');
  const [adSubtitle, setAdSubtitle] = useState('');
  const [adLink, setAdLink] = useState('/catalogue');
  const [adImage, setAdImage] = useState('');
  const [adSlot, setAdSlot] = useState<AdSlot>('hero');
  const [adBusy, setAdBusy] = useState(false);

  const canAds =
    active?.planCode === 'vendor_business' &&
    (active.features.adSlots ?? 0) > 0;

  const reload = async () => {
    if (!user) return;
    const [p, a, myAds, t] = await Promise.all([
      fetchPlans('vendor'),
      fetchActiveSubscription(),
      fetchMyAds(user.id),
      fetchSubscriptionTerms(),
    ]);
    setPlans(p);
    setActive(a?.audience === 'vendor' ? a : null);
    setAds(myAds);
    setTerms(t);
  };

  const selectedTerm = useMemo(
    () => terms.find((t) => t.months === months) ?? terms[0],
    [terms, months]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const subscribe = async (plan: SubscriptionPlan) => {
    if (!user || plan.priceXof <= 0) return;
    setBusyId(plan.id);
    setError(null);
    setOkMsg(null);
    try {
      const res = await startSubscriptionCheckout({
        planId: plan.id,
        userId: user.id,
        phone: user.phone || '',
        months,
        customerName: user.fullName,
        customerEmail: user.email,
        country: country || user.vendor?.country || 'BF',
      });
      if (res.paymentUrl) {
        window.location.assign(res.paymentUrl);
        return;
      }
      setOkMsg(
        `Plan ${plan.name} activé pour ${res.months} mois — ${formatXof(res.amountXof)} (simulation).`
      );
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Paiement impossible');
    } finally {
      setBusyId(null);
    }
  };

  const submitAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canAds) return;
    setAdBusy(true);
    setError(null);
    try {
      const ad = await createAdPlacement({
        userId: user.id,
        vendorId: user.vendor?.id,
        subscriptionId: active?.id,
        slot: adSlot,
        title: adTitle,
        subtitle: adSubtitle,
        linkUrl: adLink || (user.vendor?.shopSlug ? `/boutique/${user.vendor.shopSlug}` : '/catalogue'),
        imageUrl: adImage || undefined,
      });
      await setAdStatus(ad.id, 'active');
      setOkMsg('Publicité créée — elle apparaît sur l’accueil (hero / bandeau).');
      setAdTitle('');
      setAdSubtitle('');
      setAdImage('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur pub');
    } finally {
      setAdBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border rounded-2xl p-8 flex justify-center">
        <Loader2 className="animate-spin text-[#FF6B00]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="text-[#FF6B00]" size={22} />
          <h1 className="text-xl font-extrabold">Abonnement & publicité</h1>
        </div>
        <p className="text-sm text-gray-500">
          Boostez votre boutique : mise en avant produits, priorité accueil, et pubs Business.
        </p>
        {active ? (
          <div className="mt-4 rounded-xl bg-[#00A651]/10 border border-[#00A651]/30 p-4 text-sm">
            <p className="font-bold text-[#00A651]">
              Actif : {active.planName} · {active.termMonths} mois
              {active.discountPct > 0 &&
                ` (remise engagement −${Math.round(active.discountPct * 100)} %)`}
            </p>
            {active.amountPaidXof != null && (
              <p className="text-gray-600 mt-1">
                Payé : <strong>{formatXof(active.amountPaidXof)}</strong>
              </p>
            )}
            {active.endsAt && (
              <p className="text-gray-600 mt-1">
                Jusqu’au{' '}
                {new Date(active.endsAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
            <ul className="mt-2 text-xs text-gray-600 space-y-1 list-disc pl-4">
              <li>Produits mis en avant automatiquement sur l’accueil / catalogue</li>
              <li>Badge Pro ou Business sur votre boutique</li>
              <li>Priorité dans « Vendeurs vedettes »</li>
              {active.planCode === 'vendor_business' && (
                <>
                  <li>Commission réduite à 7 % sur les nouvelles commandes</li>
                  <li>Publiez une pub hero / bandeau ci-dessous pour l’accueil</li>
                </>
              )}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-sm text-amber-700 font-medium">Plan Gratuit — passez Pro ou Business.</p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
      )}
      {okMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 text-sm">
          {okMsg}
        </div>
      )}

      {terms.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <SubscriptionTermPicker
            terms={terms}
            selectedMonths={months}
            onSelect={setMonths}
            monthlyPriceXof={
              plans.find((p) => p.code === 'vendor_pro')?.priceXof ??
              plans.find((p) => p.priceXof > 0)?.priceXof ??
              0
            }
          />
          <p className="text-xs text-gray-500 mt-3">
            Remise d’engagement à partir de 12 mois : −10 % sur 1 an, −15 % sur 2 ans, −25 %
            sur 4 ans. Le tarif est bloqué pendant toute la durée souscrite.
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isCurrent = active?.planCode === plan.code;
          const quote = selectedTerm ? quoteSubscription(plan.priceXof, selectedTerm) : null;
          return (
            <div
              key={plan.id}
              className={`bg-white border rounded-2xl p-5 ${
                plan.code === 'vendor_business'
                  ? 'border-[#FF6B00] ring-1 ring-[#FF6B00]/30'
                  : 'border-gray-100'
              }`}
            >
              <h3 className="font-extrabold text-lg">{plan.name}</h3>
              <p className="text-[#FF6B00] font-bold mt-1">{formatPlanPrice(plan.priceXof)}</p>
              {plan.priceXof > 0 && quote && selectedTerm && (
                <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 p-3 text-sm">
                  <p className="font-extrabold text-[#1F2937]">
                    {formatTermLabel(selectedTerm)} : {formatXof(quote.totalXof)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    soit {formatXof(quote.effectiveMonthlyXof)} / mois
                  </p>
                  {quote.discountXof > 0 && (
                    <p className="text-xs font-bold text-[#00A651] mt-1">
                      Économie {formatXof(quote.discountXof)} (−
                      {Math.round(quote.discountPct * 100)} %)
                    </p>
                  )}
                </div>
              )}
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                {vendorBenefits(plan).map((b) => (
                  <li key={b} className="flex gap-2">
                    <Check size={16} className="text-[#00A651] shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              {plan.priceXof > 0 ? (
                <button
                  type="button"
                  disabled={!!busyId}
                  onClick={() => subscribe(plan)}
                  className="mt-5 w-full py-3 rounded-xl font-bold text-white bg-[#FF6B00] disabled:bg-gray-300"
                >
                  {busyId === plan.id
                    ? '…'
                    : isCurrent
                      ? 'Prolonger / changer de durée'
                      : 'Choisir'}
                </button>
              ) : (
                <p className="mt-5 text-xs text-center text-gray-400 font-semibold">Par défaut</p>
              )}
            </div>
          );
        })}
      </div>

      {canAds && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone size={20} className="text-[#FF6B00]" />
            <h2 className="font-extrabold">Créer une publicité</h2>
          </div>
          <form onSubmit={submitAd} className="space-y-3 max-w-xl">
            <div>
              <label className="block text-sm font-bold mb-1">Emplacement</label>
              <select
                value={adSlot}
                onChange={(e) => setAdSlot(e.target.value as AdSlot)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
              >
                <option value="hero">Carrousel hero (accueil)</option>
                <option value="home_banner">Bandeau accueil</option>
                <option value="featured_vendor">Vendeur mis en avant</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Titre *</label>
              <input
                required
                value={adTitle}
                onChange={(e) => setAdTitle(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
                placeholder="Ex. −20 % sur l’électronique"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Sous-titre</label>
              <input
                value={adSubtitle}
                onChange={(e) => setAdSubtitle(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Lien</label>
              <input
                value={adLink}
                onChange={(e) => setAdLink(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
                placeholder="/boutique/mon-slug"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Image (URL)</label>
              <input
                value={adImage}
                onChange={(e) => setAdImage(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
                placeholder="https://… (logo boutique utilisé si vide)"
              />
            </div>
            <button
              type="submit"
              disabled={adBusy}
              className="px-5 py-3 bg-[#00A651] text-white rounded-xl font-bold disabled:opacity-60"
            >
              {adBusy ? 'Publication…' : 'Publier sur l’accueil'}
            </button>
          </form>

          {ads.length > 0 && (
            <ul className="mt-6 space-y-2 text-sm">
              {ads.map((ad) => (
                <li
                  key={ad.id}
                  className="flex flex-wrap items-center justify-between gap-2 border rounded-xl px-3 py-2"
                >
                  <span>
                    <strong>{ad.title}</strong> · {ad.slot} · {ad.status}
                  </span>
                  {ad.status === 'active' && (
                    <button
                      type="button"
                      className="text-xs font-bold text-red-600"
                      onClick={() => setAdStatus(ad.id, 'ended').then(reload)}
                    >
                      Couper
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
