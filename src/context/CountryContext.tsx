import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

const STORAGE_KEY = 'afrizone_selected_country';
const LEGACY_CITY_KEY = 'afrizone_selected_city';

interface CountryContextType {
  country: CatalogCountryCode;
  countryName: string;
  setCountry: (code: CatalogCountryCode) => void;
  countries: typeof CATALOG_COUNTRIES;
}

const CountryContext = createContext<CountryContextType | undefined>(undefined);

function isCountryCode(value: string): value is CatalogCountryCode {
  return CATALOG_COUNTRIES.some((c) => c.code === value);
}

function readStoredCountry(): CatalogCountryCode | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isCountryCode(stored)) return stored;

    // Migration depuis l’ancien sélecteur « ville »
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

  const setCountry = useCallback((next: CatalogCountryCode) => {
    if (!isCountryCode(next)) return;
    setCountryState(next);
    writeStoredCountry(next);
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const stored = readStoredCountry();
    if (stored) {
      setCountryState(stored);
      return;
    }

    if (isAuthenticated && user) {
      const fromProfile =
        countryCodeFromLabelOrCity(user.vendor?.country) ||
        countryCodeFromLabelOrCity(user.driver?.country) ||
        countryCodeFromLabelOrCity(user.city) ||
        countryCodeFromLabelOrCity(user.vendor?.city) ||
        countryCodeFromLabelOrCity(user.driver?.city);
      if (fromProfile) {
        setCountryState(fromProfile);
        writeStoredCountry(fromProfile);
      }
    }
  }, [isLoading, isAuthenticated, user]);

  return (
    <CountryContext.Provider
      value={{
        country,
        countryName: countryLabel(country),
        setCountry,
        countries: CATALOG_COUNTRIES,
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
