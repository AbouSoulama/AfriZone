import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { CATALOG_CITIES } from '../types/catalog';

const STORAGE_KEY = 'afrizone_selected_city';

interface CityContextType {
  city: string;
  setCity: (city: string) => void;
  cities: readonly string[];
}

const CityContext = createContext<CityContextType | undefined>(undefined);

function isCatalogCity(value: string): boolean {
  return (CATALOG_CITIES as readonly string[]).includes(value);
}

/** Normalise une ville profil/boutique vers une ville catalogue connue */
export function normalizeCatalogCity(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (isCatalogCity(trimmed)) return trimmed;

  const lower = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (
    lower.includes('ouaga') ||
    lower.includes('bobo') ||
    lower.includes('burkina') ||
    lower === 'bf'
  ) {
    return 'Ouagadougou';
  }
  if (
    lower.includes('bamako') ||
    lower.includes('sikasso') ||
    lower.includes('mali') ||
    lower === 'ml'
  ) {
    return 'Bamako';
  }
  if (
    lower.includes('dakar') ||
    lower.includes('thies') ||
    lower.includes('senegal') ||
    lower === 'sn'
  ) {
    return 'Dakar';
  }

  return null;
}

function readStoredCity(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isCatalogCity(stored)) return stored;
  } catch {
    /* ignore */
  }
  return null;
}

function writeStoredCity(city: string) {
  try {
    localStorage.setItem(STORAGE_KEY, city);
  } catch {
    /* ignore */
  }
}

export function CityProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [city, setCityState] = useState<string>(() => readStoredCity() || 'Dakar');

  const setCity = useCallback((next: string) => {
    if (!isCatalogCity(next)) return;
    setCityState(next);
    writeStoredCity(next);
  }, []);

  // Priorité : localStorage (choix explicite) > ville profil > Dakar
  useEffect(() => {
    if (isLoading) return;

    const stored = readStoredCity();
    if (stored) {
      setCityState(stored);
      return;
    }

    if (isAuthenticated && user) {
      const fromProfile =
        normalizeCatalogCity(user.city) ||
        normalizeCatalogCity(user.vendor?.city) ||
        normalizeCatalogCity(user.driver?.city);
      if (fromProfile) {
        setCityState(fromProfile);
        writeStoredCity(fromProfile);
      }
    }
  }, [isLoading, isAuthenticated, user]);

  return (
    <CityContext.Provider value={{ city, setCity, cities: CATALOG_CITIES }}>
      {children}
    </CityContext.Provider>
  );
}

export function useCity() {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error('useCity must be used within CityProvider');
  return ctx;
}
