import { Loader2, MapPin, Navigation, RefreshCw, ShieldAlert } from 'lucide-react';
import { useCountry } from '../context/CountryContext';
import type { CatalogCountryCode } from '../types/catalog';
import { SERVICE_COUNTRY_LABELS, serviceUnavailableMessage } from '../lib/geo-country';
import BrandLogo from './BrandLogo';

const FLAG: Record<CatalogCountryCode, string> = {
  SN: '🇸🇳',
  BF: '🇧🇫',
  ML: '🇲🇱',
  GN: '🇬🇳',
};

/**
 * Écran d’entrée :
 * - détection auto GPS / IP
 * - si pays AfriZone → entrée automatique
 * - si hors zone → consultation possible, inscription/paiement bloqués
 * - si détection impossible → choix manuel parmi les 4 pays
 */
export default function CountryGate() {
  const {
    countries,
    setCountry,
    hasChosenCountry,
    geo,
    isDetectingGeo,
    refreshGeo,
    canRegisterOrPay,
  } = useCountry();

  // Pendant la détection initiale, on évite de flash-afficher le choix manuel
  if (!hasChosenCountry && isDetectingGeo && !geo) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0f172a]/80 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl px-6 py-10 text-center">
          <div className="mb-4 flex justify-center">
            <BrandLogo to={null} size="lg" className="h-12" />
          </div>
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#00A651]" />
          <p className="font-extrabold text-[#1F2937]">Détection de votre emplacement…</p>
          <p className="mt-2 text-sm text-gray-500">
            Autorisez la localisation pour accéder automatiquement à votre pays.
          </p>
        </div>
      </div>
    );
  }

  // Pays détecté et déjà appliqué → pas de gate
  if (hasChosenCountry && canRegisterOrPay) return null;

  // Pays hors zone : l’utilisateur peut quand même choisir un catalogue, mais on
  // affiche le bandeau tant qu’il n’a pas choisi (et on le re-montre nulle part
  // ailleurs — le blocage inscription/paiement est géré par ServiceCountryGuard).
  if (hasChosenCountry) return null;

  const blocked = geo?.availability === 'blocked';
  const unknown = !geo || geo.availability === 'unknown';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0f172a]/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden animate-fade-in">
        <div
          className={`px-6 py-8 text-white text-center ${
            blocked
              ? 'bg-gradient-to-br from-amber-600 to-orange-700'
              : 'bg-gradient-to-br from-[#00A651] to-[#008A43]'
          }`}
        >
          <div className="mb-4 flex justify-center">
            <BrandLogo to={null} size="lg" onDark className="h-14" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {blocked ? 'Pays non pris en charge' : 'Bienvenue sur AfriZone'}
          </h1>
          <p className="mt-2 text-sm text-white/90 leading-relaxed">
            {blocked
              ? serviceUnavailableMessage(geo?.countryName || geo?.isoCode)
              : 'Nous détectons votre emplacement pour afficher le bon catalogue, les vendeurs et les livraisons.'}
          </p>
        </div>

        <div className="p-6 space-y-3">
          {(geo?.countryName || geo?.city) && (
            <div className="flex items-start gap-2 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
              <Navigation size={16} className="mt-0.5 shrink-0 text-[#FF6B00]" />
              <div>
                <p className="font-bold">
                  Emplacement détecté
                  {geo?.source === 'gps' ? ' (GPS)' : geo?.source === 'ip' ? ' (réseau)' : ''}
                </p>
                <p className="text-xs text-gray-500">
                  {[geo?.city, geo?.countryName || geo?.isoCode].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          )}

          {blocked && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              <ShieldAlert size={16} className="mt-0.5 shrink-0" />
              <p>
                Vous pouvez consulter le catalogue en choisissant un pays ci-dessous. L’inscription
                et le paiement restent réservés à : {SERVICE_COUNTRY_LABELS}.
              </p>
            </div>
          )}

          {unknown && (
            <p className="text-xs text-gray-500">
              {geo?.error
                ? `${geo.error} Choisissez votre pays manuellement, ou réessayez la détection.`
                : 'Choisissez votre pays pour continuer.'}
            </p>
          )}

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

          <button
            type="button"
            disabled={isDetectingGeo}
            onClick={() => void refreshGeo(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 px-4 py-3 text-sm font-bold text-[#1F2937] hover:border-[#00A651] disabled:opacity-60"
          >
            {isDetectingGeo ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            {isDetectingGeo ? 'Détection…' : 'Relancer la géolocalisation'}
          </button>

          <p className="text-[11px] text-gray-400 text-center pt-1">
            Pays ouverts : {SERVICE_COUNTRY_LABELS}.
          </p>
        </div>
      </div>
    </div>
  );
}
