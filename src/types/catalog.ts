export type DeliveryMode = 'vendor' | 'afrizone';
export type ProductCondition = 'neuf' | 'occasion';

export interface CatalogVendor {
  id: string;
  shopName: string;
  shopSlug: string;
  shopDescription: string | null;
  shopCategory: string | null;
  shopLogoUrl: string | null;
  vendorCode: string;
  country: string;
  city: string;
  rating: number;
  reviewCount?: number;
  totalSales: number;
  status: string;
  /** Badges CDC */
  isGoldSeller?: boolean;
  isTopRated?: boolean;
}

export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  subcategory: string | null;
  price: number;
  oldPrice: number | null;
  currency: string;
  stock: number;
  condition: string;
  weightKg: number | null;
  deliveryMode: DeliveryMode;
  deliveryZones: string[] | null;
  vendorDeliveryFee: number | null;
  images: string[];
  mainImage: string | null;
  rating: number;
  reviewCount: number;
  soldCount: number;
  isActive: boolean;
  isFeatured: boolean;
  tags: string[];
  createdAt: string;
  vendor?: CatalogVendor | null;
}

export type CatalogSort =
  | 'relevance'
  | 'price_asc'
  | 'price_desc'
  | 'popular'
  | 'recent';

export interface CatalogFilters {
  q?: string;
  category?: string;
  /** Code pays : SN | BF | ML */
  country?: string;
  /** @deprecated utiliser country */
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: ProductCondition | '';
  verifiedOnly?: boolean;
  sort?: CatalogSort;
  page?: number;
  pageSize?: number;
}

export interface CatalogResult {
  products: CatalogProduct[];
  total: number;
  page: number;
  pageSize: number;
}

export const CATALOG_CATEGORIES = [
  'Électronique',
  'Mode',
  'Maison',
  'Beauté',
  'Alimentation',
  'Sport',
  'Livres',
  'Auto',
] as const;

/** Pays couverts par AfriZone (sélecteur principal du site) */
export const CATALOG_COUNTRIES = [
  { code: 'BF', label: 'Burkina Faso', capital: 'Ouagadougou' },
  { code: 'ML', label: 'Mali', capital: 'Bamako' },
  { code: 'SN', label: 'Sénégal', capital: 'Dakar' },
] as const;

export type CatalogCountryCode = (typeof CATALOG_COUNTRIES)[number]['code'];

/** Villes par pays (adresses / checkout — pas le filtre catalogue) */
export const CITIES_BY_COUNTRY: Record<CatalogCountryCode, string[]> = {
  SN: ['Dakar', 'Thies', 'Saint-Louis', 'Ziguinchor', 'Kaolack', 'Touba'],
  BF: ['Ouagadougou', 'Bobo-Dioulasso', 'Koudougou', 'Banfora', 'Ouahigouya', 'Kaya'],
  ML: ['Bamako', 'Sikasso', 'Segou', 'Mopti', 'Kayes'],
};

/** @deprecated préférer CATALOG_COUNTRIES — conservé pour compat */
export const CATALOG_CITIES = ['Dakar', 'Ouagadougou', 'Bamako'] as const;

export function countryLabel(code?: string | null): string {
  if (!code) return '';
  const found = CATALOG_COUNTRIES.find((c) => c.code === code);
  return found?.label || code;
}

export function countryCodeFromLabelOrCity(raw?: string | null): CatalogCountryCode | null {
  if (!raw) return null;
  const t = raw.trim();
  const byCode = CATALOG_COUNTRIES.find((c) => c.code === t.toUpperCase());
  if (byCode) return byCode.code;

  const lower = t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (
    lower.includes('burkina') ||
    lower.includes('ouaga') ||
    lower.includes('bobo') ||
    lower === 'bf'
  ) {
    return 'BF';
  }
  if (lower.includes('mali') || lower.includes('bamako') || lower.includes('sikasso') || lower === 'ml') {
    return 'ML';
  }
  if (
    lower.includes('senegal') ||
    lower.includes('dakar') ||
    lower.includes('thies') ||
    lower === 'sn'
  ) {
    return 'SN';
  }

  const byLabel = CATALOG_COUNTRIES.find(
    (c) =>
      c.label
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase() === lower
  );
  return byLabel?.code ?? null;
}

export function capitalForCountry(code: CatalogCountryCode): string {
  return CATALOG_COUNTRIES.find((c) => c.code === code)?.capital || 'Dakar';
}
