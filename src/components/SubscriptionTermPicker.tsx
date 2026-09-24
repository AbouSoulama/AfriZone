import { Check } from 'lucide-react';
import {
  formatTermLabel,
  formatXof,
  quoteSubscription,
  type SubscriptionTerm,
} from '../services/subscriptions';

/**
 * Sélecteur de durée d'engagement (1, 6, 12, 24, 48 mois).
 * La remise s'applique à partir de 12 mois et s'affiche sur chaque option.
 */
export default function SubscriptionTermPicker({
  terms,
  selectedMonths,
  onSelect,
  monthlyPriceXof,
}: {
  terms: SubscriptionTerm[];
  selectedMonths: number;
  onSelect: (months: number) => void;
  /** Prix mensuel de référence, pour afficher l'économie. 0 = plan gratuit. */
  monthlyPriceXof: number;
}) {
  return (
    <div>
      <p className="text-sm font-bold mb-2">Durée d’engagement</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {terms.map((term) => {
          const quote = quoteSubscription(monthlyPriceXof, term);
          const isSelected = term.months === selectedMonths;
          return (
            <button
              key={term.months}
              type="button"
              onClick={() => onSelect(term.months)}
              className={`relative text-left px-3 py-2.5 rounded-xl border-2 transition-colors ${
                isSelected
                  ? 'border-[#FF6B00] bg-orange-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {term.discountPct > 0 && (
                <span className="absolute -top-2 -right-1 bg-[#00A651] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                  −{Math.round(term.discountPct * 100)} %
                </span>
              )}
              <span className="flex items-center gap-1 font-extrabold text-sm">
                {isSelected && <Check size={13} className="text-[#FF6B00]" />}
                {formatTermLabel(term)}
              </span>
              {monthlyPriceXof > 0 && (
                <>
                  <span className="block text-xs text-gray-600 mt-0.5">
                    {formatXof(quote.effectiveMonthlyXof)} / mois
                  </span>
                  <span className="block text-[11px] text-gray-400">
                    Total {formatXof(quote.totalXof)}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
