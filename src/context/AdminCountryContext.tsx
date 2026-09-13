import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import {
  CATALOG_COUNTRIES,
  countryLabel,
  type CatalogCountryCode,
} from '../types/catalog';

const STORAGE_KEY = 'afrizone_admin_country';

export type AdminCountryFilter = CatalogCountryCode | 'ALL';

interface AdminCountryContextType {
  adminCountry: AdminCountryFilter;
  adminCountryName: string;
  setAdminCountry: (code: AdminCountryFilter) => void;
  countries: typeof CATALOG_COUNTRIES;
}

const AdminCountryContext = createContext<AdminCountryContextType | undefined>(undefined);

function readStored(): AdminCountryFilter {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'ALL') return 'ALL';
    if (v && CATALOG_COUNTRIES.some((c) => c.code === v)) return v as CatalogCountryCode;
  } catch {
    /* ignore */
  }
  return 'SN';
}

export function AdminCountryProvider({ children }: { children: ReactNode }) {
  const [adminCountry, setAdminCountryState] = useState<AdminCountryFilter>(readStored);

  const setAdminCountry = useCallback((next: AdminCountryFilter) => {
    setAdminCountryState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <AdminCountryContext.Provider
      value={{
        adminCountry,
        adminCountryName:
          adminCountry === 'ALL' ? 'Tous les pays' : countryLabel(adminCountry),
        setAdminCountry,
        countries: CATALOG_COUNTRIES,
      }}
    >
      {children}
    </AdminCountryContext.Provider>
  );
}

export function useAdminCountry() {
  const ctx = useContext(AdminCountryContext);
  if (!ctx) throw new Error('useAdminCountry must be used within AdminCountryProvider');
  return ctx;
}
