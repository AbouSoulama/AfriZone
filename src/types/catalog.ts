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
  totalSales: number;
  status: string;
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

export const CATALOG_CITIES = ['Dakar', 'Ouagadougou', 'Bamako'] as const;
