import { useEffect, useMemo, useState } from 'react';
import { Check, Crown, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCountry } from '../../context/CountryContext';
import SubscriptionTermPicker from '../../components/SubscriptionTermPicker';
import {
  fetchActiveSubscription,
  fetchPlans,
  fetchSubscriptionTerms,
  formatPlanPrice,
  formatTermLabel,
  formatXof,
  quoteSubscription,
  startSubscriptionCheckout,
  type ActiveSubscription,
  type SubscriptionPlan,
  type SubscriptionTerm,
} from '../../services/subscriptions';

function planBenefits(plan: SubscriptionPlan): string[] {
  const f = plan.features;
  if (plan.code === 'client_club') {
    return [
      'Badge membre AfriZone Club',
      `−${f.shippingDiscount ?? 1000} FCFA sur la livraison (max ${f.shippingCreditsPerMonth ?? 4}× / mois)`,
      'Accès prioritaire aux promos catalogue',
    ];
  }
  if (plan.priceXof <= 0) {
    return ['Commandes et suivi', 'Adresses enregistrées', 'Assistance standard'];
  }
  return ['Avantages abonnement'];
}

export default function AccountSubscriptionPage() {
  const { user } = useAuth();
  const { country } = useCountry();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [terms, setTerms] = useState<SubscriptionTerm[]>([]);
  const [months, setMonths] = useState(1);
  const [active, setActive] = useState<ActiveSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const reload = async () => {
    const [p, a, t] = await Promise.all([
      fetchPlans('client'),
      fetchActiveSubscription(),
      fetchSubscriptionTerms(),
    ]);
    setPlans(p);
    setActive(a?.audience === 'client' ? a : null);
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
  }, []);

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
        country: country || 'BF',
      });
      if (res.paymentUrl) {
        window.location.assign(res.paymentUrl);
        return;
      }
      setOkMsg(
        `AfriZone Club activé pour ${res.months} mois — ${formatXof(res.amountXof)} (simulation).`
      );
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Paiement impossible');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border rounded-2xl p-8 flex justify-center">
        <Loader2 className="animate-spin text-[#FF6B00]" />
      </div>
    );
  }

  const creditsLeft =
    active && active.planCode === 'client_club'
      ? Math.max(0, active.shippingCreditsQuota - active.shippingCreditsUsed)
      : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <Crown className="text-[#FF6B00]" size={22} />
          <h2 className="text-xl font-extrabold">Abonnement client</h2>
        </div>
        <p className="text-sm text-gray-500">
          AfriZone Club réduit vos frais de livraison et vous donne un badge membre.
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
                Valable jusqu’au{' '}
                {new Date(active.endsAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
            {active.planCode === 'client_club' && (
              <>
                <p className="text-gray-600 mt-1">
                  Crédits livraison restants : <strong>{creditsLeft}</strong> /{' '}
                  {active.shippingCreditsQuota}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Avantage réel : −1 000 FCFA sur les frais de livraison au checkout (max 4
                  commandes / mois). Badge Club visible dans le menu.
                </p>
              </>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-amber-700 font-medium">Aucun abonnement payant actif.</p>
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
            monthlyPriceXof={plans.find((p) => p.priceXof > 0)?.priceXof ?? 0}
          />
          <p className="text-xs text-gray-500 mt-3">
            Plus l’engagement est long, plus la remise est forte : les réductions démarrent à
            partir de 12 mois. Le paiement se fait en une fois pour toute la durée choisie.
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {plans.map((plan) => {
          const isCurrent = active?.planCode === plan.code;
          const quote = selectedTerm ? quoteSubscription(plan.priceXof, selectedTerm) : null;
          return (
            <div
              key={plan.id}
              className={`bg-white border rounded-2xl p-5 ${
                plan.priceXof > 0 ? 'border-[#FF6B00]/40 shadow-sm' : 'border-gray-100'
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
                      Vous économisez {formatXof(quote.discountXof)} (−
                      {Math.round(quote.discountPct * 100)} %)
                    </p>
                  )}
                </div>
              )}
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                {planBenefits(plan).map((b) => (
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
                  className="mt-5 w-full py-3 rounded-xl font-bold text-white bg-[#FF6B00] hover:bg-[#E05E00] disabled:bg-gray-300"
                >
                  {busyId === plan.id
                    ? 'Ouverture…'
                    : isCurrent
                      ? 'Prolonger / changer de durée'
                      : 'S’abonner'}
                </button>
              ) : (
                <p className="mt-5 text-xs text-center text-gray-400 font-semibold">Inclus par défaut</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
