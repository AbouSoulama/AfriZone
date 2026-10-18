import { paymentMethodsForCountry, PAYMENT_BRAND_COLOR } from '../data/country-payments';
import { countryLabel, type CatalogCountryCode } from '../types/catalog';

interface PaymentMethodPickerProps {
  country: CatalogCountryCode;
  value: string;
  onChange: (id: string) => void;
}

export default function PaymentMethodPicker({ country, value, onChange }: PaymentMethodPickerProps) {
  const methods = paymentMethodsForCountry(country);

  return (
    <div>
      <p className="text-sm font-bold mb-1">Moyen de paiement</p>
      <p className="text-xs text-gray-500 mb-3">
        Affichés pour {countryLabel(country)}. Le numéro doit être celui de l’opérateur choisi.
      </p>
      {methods.length === 0 ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
          Aucun moyen n’est configuré pour ce pays.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {methods.map((method) => {
            const selected = method.id === value;
            const color = PAYMENT_BRAND_COLOR[method.brand];
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => onChange(method.id)}
                aria-pressed={selected}
                className={`flex items-center gap-3 text-left rounded-2xl border-2 px-3 py-3 transition-colors ${
                  selected
                    ? 'border-[#1F2937] bg-white shadow-sm'
                    : 'border-gray-100 bg-white hover:border-gray-300'
                }`}
              >
                <span
                  className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-[10px] font-extrabold tracking-wide"
                  style={{ background: color.bg, color: color.fg }}
                >
                  {method.brand === 'malitel' ? 'MT' : method.brand.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-extrabold text-[#1F2937] truncate">
                    {method.label}
                  </span>
                  <span className="block text-[11px] text-gray-500 truncate">
                    {method.hint} · {method.dial}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
