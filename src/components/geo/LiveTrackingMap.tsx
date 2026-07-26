import { MapPin, Navigation, Route } from 'lucide-react';
import {
  googleMapsDirectionsUrl,
  osmEmbedUrl,
  type LatLng,
} from '../../lib/geo';

interface LiveMapProps {
  driver?: LatLng | null;
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  distanceKm?: number | null;
  etaMinutes?: number | null;
  updatedAt?: string | null;
}

export default function LiveTrackingMap({
  driver,
  pickup,
  dropoff,
  distanceKm,
  etaMinutes,
  updatedAt,
}: LiveMapProps) {
  const center = driver || pickup || dropoff || { lat: 14.7167, lng: -17.4677 };
  const routeUrl =
    pickup && dropoff ? googleMapsDirectionsUrl(pickup, dropoff) : null;
  const liveRouteUrl =
    driver && dropoff ? googleMapsDirectionsUrl(driver, dropoff) : null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Navigation size={16} className="text-[#FF6B00]" />
          <p className="font-extrabold text-sm">Suivi en direct</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          {distanceKm != null && (
            <span className="inline-flex items-center gap-1">
              <Route size={12} /> {distanceKm} km
            </span>
          )}
          {etaMinutes != null && <span>~{etaMinutes} min</span>}
          {updatedAt && (
            <span>Maj {new Date(updatedAt).toLocaleTimeString('fr-FR')}</span>
          )}
        </div>
      </div>

      <iframe
        title="Carte suivi"
        className="w-full h-64 md:h-80 border-0"
        src={osmEmbedUrl(center, 13)}
      />

      <div className="p-4 space-y-2 text-sm">
        {driver && (
          <p className="flex items-start gap-2 text-gray-700">
            <MapPin size={14} className="text-[#FF6B00] mt-0.5 shrink-0" />
            <span>
              Livreur : {driver.lat.toFixed(5)}, {driver.lng.toFixed(5)}
            </span>
          </p>
        )}
        {!driver && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
            En attente de la position GPS du livreur…
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {liveRouteUrl && (
            <a
              href={liveRouteUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 bg-[#FF6B00] text-white rounded-xl text-xs font-bold"
            >
              Itinéraire vers destination
            </a>
          )}
          {routeUrl && (
            <a
              href={routeUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 border-2 rounded-xl text-xs font-bold"
            >
              Trajet pickup → livraison
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
