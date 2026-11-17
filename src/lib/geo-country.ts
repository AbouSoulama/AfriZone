import {
  CATALOG_COUNTRIES,
  type CatalogCountryCode,
} from '../types/catalog';

/** Les seuls pays où l'inscription et le paiement sont autorisés. */
export const SERVICE_COUNTRY_CODES: readonly CatalogCountryCode[] = CATALOG_COUNTRIES.map(
  (c) => c.code
);

export const SERVICE_COUNTRY_LABELS = CATALOG_COUNTRIES.map((c) => c.label).join(', ');

export type GeoDetectionSource = 'gps' | 'ip' | 'none';
export type GeoAvailability = 'allowed' | 'blocked' | 'unknown';

export interface GeoCountryResult {
  availability: GeoAvailability;
  /** Renseigné uniquement si le pays détecté fait partie des 4 pays AfriZone. */
  country: CatalogCountryCode | null;
  isoCode: string | null;
  countryName: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  source: GeoDetectionSource;
  error?: string;
}

const GEO_CACHE_KEY = 'afrizone_geo_country_v1';
const GEO_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

export function isServiceCountry(code: string | null | undefined): code is CatalogCountryCode {
  if (!code) return false;
  const upper = code.trim().toUpperCase();
  return (SERVICE_COUNTRY_CODES as readonly string[]).includes(upper);
}

export function serviceUnavailableMessage(detectedName?: string | null): string {
  const where = detectedName?.trim()
    ? `Votre emplacement indique : ${detectedName}. `
    : '';
  return (
    where +
    `AfriZone n’autorise l’inscription et le paiement que depuis ${SERVICE_COUNTRY_LABELS}.`
  );
}

function normalizeIso(code: string | null | undefined): string | null {
  if (!code) return null;
  return code.trim().toUpperCase() || null;
}

function toResult(input: {
  isoCode: string | null;
  countryName?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source: GeoDetectionSource;
  error?: string;
}): GeoCountryResult {
  const iso = normalizeIso(input.isoCode);
  const country = iso && isServiceCountry(iso) ? iso : null;
  let availability: GeoAvailability = 'unknown';
  if (iso) availability = country ? 'allowed' : 'blocked';
  else if (input.error) availability = 'unknown';

  return {
    availability,
    country,
    isoCode: iso,
    countryName: input.countryName?.trim() || null,
    city: input.city?.trim() || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    source: input.source,
    error: input.error,
  };
}

interface BigDataCloudResponse {
  countryCode?: string;
  countryName?: string;
  city?: string;
  locality?: string;
  latitude?: number;
  longitude?: number;
  lookupSource?: string;
}

async function reverseGeocode(lat?: number, lng?: number): Promise<BigDataCloudResponse> {
  const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
  url.searchParams.set('localityLanguage', 'fr');
  if (typeof lat === 'number' && typeof lng === 'number') {
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lng));
  }
  const res = await fetch(url.toString(), { method: 'GET' });
  if (!res.ok) throw new Error(`Géolocalisation indisponible (${res.status}).`);
  return (await res.json()) as BigDataCloudResponse;
}

function readGpsPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('La géolocalisation n’est pas disponible sur cet appareil.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 18000,
      maximumAge: 60_000,
    });
  });
}

function readCache(): GeoCountryResult | null {
  try {
    const raw = sessionStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; result: GeoCountryResult };
    if (!parsed?.at || Date.now() - parsed.at > GEO_CACHE_TTL_MS) return null;
    if (!parsed.result?.availability) return null;
    return parsed.result;
  } catch {
    return null;
  }
}

function writeCache(result: GeoCountryResult) {
  try {
    // On ne cache pas un échec total : on retentera au prochain essai.
    if (result.availability === 'unknown') return;
    sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ at: Date.now(), result }));
  } catch {
    /* ignore */
  }
}

export function clearGeoCountryCache() {
  try {
    sessionStorage.removeItem(GEO_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Détecte le pays de l’utilisateur :
 * 1) GPS appareil + reverse geocode
 * 2) sinon IP (même API, sans coordonnées)
 */
export async function detectUserCountry(options?: {
  /** Ignore le cache session (bouton « Réessayer »). */
  force?: boolean;
  /** Si false, saute le GPS et utilise uniquement l’IP. */
  preferGps?: boolean;
}): Promise<GeoCountryResult> {
  if (!options?.force) {
    const cached = readCache();
    if (cached) return cached;
  }

  const preferGps = options?.preferGps !== false;
  let gpsError: string | undefined;

  if (preferGps) {
    try {
      const pos = await readGpsPosition();
      const data = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      const result = toResult({
        isoCode: data.countryCode ?? null,
        countryName: data.countryName ?? null,
        city: data.city || data.locality || null,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        source: 'gps',
      });
      writeCache(result);
      return result;
    } catch (e) {
      const err = e as GeolocationPositionError | Error;
      if (typeof err === 'object' && err && 'code' in err) {
        const g = err as GeolocationPositionError;
        gpsError =
          g.code === g.PERMISSION_DENIED
            ? 'Permission de localisation refusée.'
            : g.code === g.TIMEOUT
              ? 'Délai de localisation dépassé.'
              : 'Impossible d’obtenir la position GPS.';
      } else {
        gpsError = err instanceof Error ? err.message : 'Erreur GPS.';
      }
    }
  }

  try {
    const data = await reverseGeocode();
    const result = toResult({
      isoCode: data.countryCode ?? null,
      countryName: data.countryName ?? null,
      city: data.city || data.locality || null,
      latitude: typeof data.latitude === 'number' ? data.latitude : null,
      longitude: typeof data.longitude === 'number' ? data.longitude : null,
      source: 'ip',
      error: gpsError,
    });
    writeCache(result);
    return result;
  } catch (e) {
    return toResult({
      isoCode: null,
      source: 'none',
      error:
        (e instanceof Error ? e.message : 'Détection du pays impossible.') +
        (gpsError ? ` (${gpsError})` : ''),
    });
  }
}

/** À appeler juste avant une inscription ou un paiement. */
export async function assertCanRegisterOrPay(): Promise<CatalogCountryCode> {
  // Cache session (30 min) si déjà autorisé ; sinon nouvelle détection GPS prioritaire.
  let geo = await detectUserCountry({ force: false, preferGps: true });
  if (geo.availability !== 'allowed' || !geo.country) {
    geo = await detectUserCountry({ force: true, preferGps: true });
  }
  if (geo.availability === 'allowed' && geo.country) return geo.country;
  if (geo.availability === 'blocked') {
    throw new Error(serviceUnavailableMessage(geo.countryName || geo.isoCode));
  }
  throw new Error(
    'Nous n’avons pas pu vérifier votre pays. Autorisez la géolocalisation, puis réessayez. ' +
      `AfriZone n’est ouvert à l’inscription et au paiement qu’au ${SERVICE_COUNTRY_LABELS}.`
  );
}
