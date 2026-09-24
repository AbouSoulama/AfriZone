export type DeliveryMode = 'vendor' | 'afrizone';
export type ProductCondition = 'neuf' | 'occasion';

/** Validation admin : un produit n'est public qu'une fois `approved`. */
export type ProductApprovalStatus = 'pending' | 'approved' | 'rejected';

/** Comment AfriZone réceptionne le produit (étape 2 du formulaire vendeur). */
export type HandoverMethod = 'drop_off' | 'pickup_request' | 'vendor_stock';

/** Étape 2 : réception du produit dans l'entrepôt AfriZone. */
export interface ProductReception {
  handoverMethod: HandoverMethod | null;
  warehouseCity: string | null;
  expectedDropoffAt: string | null;
  packageCount: number | null;
  packageWeightKg: number | null;
  packageLengthCm: number | null;
  packageWidthCm: number | null;
  packageHeightCm: number | null;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
}

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
  /** Abonnement vendeur actif (pro / business) */
  subscriptionPlanCode?: string | null;
  subscriptionBoost?: boolean;
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
  /** Photos génériques / catalogue (étape 1) */
  images: string[];
  mainImage: string | null;
  /** Photos réelles du produit (étape 2, réception entrepôt) */
  realImages: string[];
  rating: number;
  reviewCount: number;
  soldCount: number;
  isActive: boolean;
  isFeatured: boolean;
  tags: string[];
  createdAt: string;
  approvalStatus: ProductApprovalStatus;
  approvalRequestedAt: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  reception: ProductReception;
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

/** Entrepôts / hubs AfriZone où le vendeur dépose sa marchandise */
export interface AfrizoneWarehouse {
  city: string;
  label: string;
  address: string;
}

export const AFRIZONE_WAREHOUSES: Record<CatalogCountryCode, AfrizoneWarehouse[]> = {
  BF: [
    {
      city: 'Ouagadougou',
      label: 'Hub Ouagadougou (Zone industrielle Kossodo)',
      address: 'Entrepôt AfriZone, Zone industrielle de Kossodo, Ouagadougou',
    },
    {
      city: 'Bobo-Dioulasso',
      label: 'Hub Bobo-Dioulasso (Secteur 21)',
      address: 'Entrepôt AfriZone, Secteur 21, Bobo-Dioulasso',
    },
  ],
  ML: [
    {
      city: 'Bamako',
      label: 'Hub Bamako (Sotuba ACI)',
      address: 'Entrepôt AfriZone, Sotuba ACI, Bamako',
    },
  ],
  SN: [
    {
      city: 'Dakar',
      label: 'Hub Dakar (Zone de captage)',
      address: 'Entrepôt AfriZone, Zone de captage, Dakar',
    },
    {
      city: 'Thies',
      label: 'Hub Thiès (Route de Dakar)',
      address: 'Entrepôt AfriZone, Route de Dakar, Thiès',
    },
  ],
};

export function warehousesForCountry(code?: string | null): AfrizoneWarehouse[] {
  const normalized = countryCodeFromLabelOrCity(code);
  if (normalized) return AFRIZONE_WAREHOUSES[normalized];
  return Object.values(AFRIZONE_WAREHOUSES).flat();
}

export const HANDOVER_METHOD_LABELS: Record<HandoverMethod, string> = {
  drop_off: 'Je dépose au hub AfriZone',
  pickup_request: 'AfriZone vient enlever chez moi',
  vendor_stock: 'Je garde le stock et je livre moi-même',
};

export const PRODUCT_APPROVAL_LABELS: Record<ProductApprovalStatus, string> = {
  pending: 'En attente de validation',
  approved: 'Approuvé',
  rejected: 'Refusé',
};
