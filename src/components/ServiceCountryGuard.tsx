import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MapPinOff, RefreshCw, ShieldAlert } from 'lucide-react';
import { useCountry } from '../context/CountryContext';
import {
  SERVICE_COUNTRY_LABELS,
  serviceUnavailableMessage,
} from '../lib/geo-country';
import BrandLogo from './BrandLogo';

interface ServiceCountryGuardProps {
  children: ReactNode;
  /** « inscription » ou « paiement » — pour le message. */
  action?: 'inscription' | 'paiement';
}

/**
 * Bloque l’accès aux écrans d’inscription / paiement si la géolocalisation
 * ne confirme pas un des 4 pays AfriZone (SN, BF, ML, GN).
 */
export default function ServiceCountryGuard({
  children,
  action = 'inscription',
}: ServiceCountryGuardProps) {
  const { geo, isDetectingGeo, canRegisterOrPay, refreshGeo } = useCountry();

  if (canRegisterOrPay) return <>{children}</>;

  const blocked = geo?.availability === 'blocked';
  const title =
    action === 'paiement'
      ? 'Paiement indisponible dans votre pays'
      : 'Inscription indisponible dans votre pays';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white border border-gray-100 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-br from-amber-600 to-orange-700 px-6 py-8 text-white text-center">
          <div className="mb-4 flex justify-center">
            <BrandLogo to="/" size="lg" onDark className="h-12" />
          </div>
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 opacity-90" />
          <h1 className="text-xl font-extrabold">{title}</h1>
        </div>

        <div className="p-6 space-y-4 text-center">
          {isDetectingGeo ? (
            <div className="flex flex-col items-center gap-2 py-4 text-gray-600">
              <Loader2 className="h-7 w-7 animate-spin text-[#00A651]" />
              <p className="text-sm font-semibold">Vérification de votre emplacement…</p>
            </div>
          ) : (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <MapPinOff size={22} />
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">
                {blocked
                  ? serviceUnavailableMessage(geo?.countryName || geo?.isoCode)
                  : `Nous n’avons pas pu confirmer que vous êtes dans un pays AfriZone. Autorisez la géolocalisation puis réessayez. Pays ouverts : ${SERVICE_COUNTRY_LABELS}.`}
              </p>
              {(geo?.countryName || geo?.city) && (
                <p className="text-xs text-gray-500">
                  Détecté : {[geo.city, geo.countryName || geo.isoCode].filter(Boolean).join(' · ')}
                  {geo.source === 'gps' ? ' (GPS)' : geo.source === 'ip' ? ' (réseau)' : ''}
                </p>
              )}
            </>
          )}

          <button
            type="button"
            disabled={isDetectingGeo}
            onClick={() => void refreshGeo(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#00A651] hover:bg-[#008A43] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {isDetectingGeo ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Relancer la géolocalisation
          </button>

          <Link
            to="/"
            className="inline-block text-sm font-bold text-[#FF6B00] hover:underline"
          >
            Retour à l’accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
