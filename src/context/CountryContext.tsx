import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  CATALOG_COUNTRIES,
  countryCodeFromLabelOrCity,
  countryLabel,
  type CatalogCountryCode,
} from '../types/catalog';
import {
  clearGeoCountryCache,
  detectUserCountry,
  isServiceCountry,
  type GeoCountryResult,
} from '../lib/geo-country';

const STORAGE_KEY = 'afrizone_selected_country';
const CHOSEN_KEY = 'afrizone_country_chosen';
const LEGACY_CITY_KEY = 'afrizone_selected_city';

interface CountryContextType {
  country: CatalogCountryCode;
  countryName: string;
  /** false = premier visite : CountryGate affiché */
  hasChosenCountry: boolean;
  setCountry: (code: CatalogCountryCode) => void;
  countries: typeof CATALOG_COUNTRIES;
  /** Résultat de la détection GPS / IP. */
  geo: GeoCountryResult | null;
  isDetectingGeo: boolean;
  /** true si la position confirme un des 4 pays (inscription + paiement OK). */
  canRegisterOrPay: boolean;
  /** Relance la détection (GPS prioritaire). */
  refreshGeo: (force?: boolean) => Promise<GeoCountryResult>;
}

const CountryContext = createContext<CountryContextType | undefined>(undefined);

function isCountryCode(value: string): value is CatalogCountryCode {
  return CATALOG_COUNTRIES.some((c) => c.code === value);
}

function readChosenFlag(): boolean {
  try {
    if (localStorage.getItem(CHOSEN_KEY) === '1') return true;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isCountryCode(stored)) return true;
    if (localStorage.getItem(LEGACY_CITY_KEY)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function writeChosenFlag() {
  try {
    localStorage.setItem(CHOSEN_KEY, '1');
  } catch {
    /* ignore */
  }
}

function readStoredCountry(): CatalogCountryCode | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isCountryCode(stored)) return stored;

    const legacyCity = localStorage.getItem(LEGACY_CITY_KEY);
    const fromLegacy = countryCodeFromLabelOrCity(legacyCity);
    if (fromLegacy) {
      localStorage.setItem(STORAGE_KEY, fromLegacy);
      return fromLegacy;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeStoredCountry(code: CatalogCountryCode) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

export function CountryProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [country, setCountryState] = useState<CatalogCountryCode>(
    () => readStoredCountry() || 'SN'
  );
  const [hasChosenCountry, setHasChosenCountry] = useState(() => readChosenFlag());
  const [geo, setGeo] = useState<GeoCountryResult | null>(null);
  const [isDetectingGeo, setIsDetectingGeo] = useState(true);
  const detectingRef = useRef(false);

  const setCountry = useCallback((next: CatalogCountryCode) => {
    if (!isCountryCode(next)) return;
    setCountryState(next);
    writeStoredCountry(next);
    writeChosenFlag();
    setHasChosenCountry(true);
  }, []);

  const applyGeoResult = useCallback(
    (result: GeoCountryResult, opts?: { autoSelect?: boolean }) => {
      setGeo(result);
      // Si on est dans un pays AfriZone : sélection automatique (emplacement détecté).
      if (opts?.autoSelect !== false && result.availability === 'allowed' && result.country) {
        setCountry(result.country);
      }
    },
    [setCountry]
  );

  const refreshGeo = useCallback(
    async (force = false) => {
      if (detectingRef.current && !force) {
        return detectUserCountry({ force: false });
      }
      detectingRef.current = true;
      setIsDetectingGeo(true);
      try {
        if (force) clearGeoCountryCache();
        const result = await detectUserCountry({ force, preferGps: true });
        applyGeoResult(result, { autoSelect: true });
        return result;
      } finally {
        detectingRef.current = false;
        setIsDetectingGeo(false);
      }
    },
    [applyGeoResult]
  );

  // Détection automatique au démarrage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsDetectingGeo(true);
      try {
        const result = await detectUserCountry({ preferGps: true });
        if (cancelled) return;
        applyGeoResult(result, { autoSelect: true });
      } finally {
        if (!cancelled) setIsDetectingGeo(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyGeoResult]);

  // Profil utilisateur / stockage local (si pas encore de pays choisi et geo inconnue)
  useEffect(() => {
    if (isLoading) return;

    const stored = readStoredCountry();
    if (stored) {
      setCountryState(stored);
      if (!hasChosenCountry) {
        writeChosenFlag();
        setHasChosenCountry(true);
      }
      return;
    }

    if (geo?.availability === 'allowed' && geo.country) {
      setCountry(geo.country);
      return;
    }

    if (isAuthenticated && user && !hasChosenCountry) {
      const fromProfile =
        countryCodeFromLabelOrCity(user.vendor?.country) ||
        countryCodeFromLabelOrCity(user.driver?.country) ||
        countryCodeFromLabelOrCity(user.city) ||
        countryCodeFromLabelOrCity(user.vendor?.city) ||
        countryCodeFromLabelOrCity(user.driver?.city);
      if (fromProfile && isServiceCountry(fromProfile)) {
        setCountry(fromProfile);
      }
    }
  }, [isLoading, isAuthenticated, user, hasChosenCountry, setCountry, geo]);

  const canRegisterOrPay = geo?.availability === 'allowed' && !!geo.country;

  return (
    <CountryContext.Provider
      value={{
        country,
        countryName: countryLabel(country),
        hasChosenCountry,
        setCountry,
        countries: CATALOG_COUNTRIES,
        geo,
        isDetectingGeo,
        canRegisterOrPay,
        refreshGeo,
      }}
    >
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry() {
  const ctx = useContext(CountryContext);
  if (!ctx) throw new Error('useCountry must be used within CountryProvider');
  return ctx;
}

/** @deprecated utiliser useCountry */
export function useCity() {
  const { country, countryName, setCountry, countries } = useCountry();
  return {
    city: countryName,
    setCity: (labelOrCode: string) => {
      const code = countryCodeFromLabelOrCity(labelOrCode);
      if (code) setCountry(code);
    },
    cities: countries.map((c) => c.label),
    country,
    setCountry,
  };
}

/** @deprecated */
export const CityProvider = CountryProvider;
