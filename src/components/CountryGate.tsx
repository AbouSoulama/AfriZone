import { MapPin } from 'lucide-react';
import { useCountry } from '../context/CountryContext';
import type { CatalogCountryCode } from '../types/catalog';

const FLAG: Record<CatalogCountryCode, string> = {
  SN: '🇸🇳',
  BF: '🇧🇫',
  ML: '🇲🇱',
};

/**
 * Écran bloquant au premier lancement : le visiteur choisit son pays
 * avant d’accéder à la marketplace (catalogue / vendeurs filtrés).
 */
export default function CountryGate() {
  const { countries, setCountry, hasChosenCountry } = useCountry();

  if (hasChosenCountry) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0f172a]/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden animate-fade-in">
        <div className="bg-gradient-to-br from-[#00A651] to-[#008A43] px-6 py-8 text-white text-center">
          <img
            src="/logo-afrizone.png"
            alt="AfriZone"
            className="h-14 mx-auto mb-4 object-contain bg-white/95 rounded-2xl p-1.5"
          />
          <h1 className="text-2xl font-extrabold tracking-tight">Bienvenue sur AfriZone</h1>
          <p className="mt-2 text-sm text-white/90 leading-relaxed">
            Une marketplace pour plusieurs pays. Choisissez votre pays pour voir les bons
            produits, vendeurs et livraisons.
          </p>
        </div>

        <div className="p-6 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
            <MapPin size={14} className="text-[#FF6B00]" /> Votre pays
          </p>
          {countries.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => setCountry(c.code)}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl border-2 border-gray-100 hover:border-[#FF6B00] hover:bg-orange-50/60 transition-colors text-left"
            >
              <span className="text-3xl" aria-hidden>
                {FLAG[c.code]}
              </span>
              <span>
                <span className="block font-extrabold text-[#1F2937]">{c.label}</span>
                <span className="text-xs text-gray-500">Catalogue & livraison locaux</span>
              </span>
            </button>
          ))}
          <p className="text-[11px] text-gray-400 text-center pt-2">
            Vous pourrez changer de pays à tout moment dans le menu.
          </p>
        </div>
      </div>
    </div>
  );
}
