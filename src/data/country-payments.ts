import type { CatalogCountryCode } from '../types/catalog';

/** Familles demandées : Orange, Moov, Telecel, MTN. Malitel est la marque Moov au Mali. */
export type PaymentBrand = 'orange' | 'moov' | 'telecel' | 'malitel' | 'mtn';

export interface CountryPaymentMethod {
  id: string;
  brand: PaymentBrand;
  country: CatalogCountryCode;
  label: string;
  hint: string;
  dial: string;
}

export const PAYMENT_BRAND_COLOR: Record<PaymentBrand, { bg: string; fg: string }> = {
  orange: { bg: '#FF6600', fg: '#ffffff' },
  moov: { bg: '#0095DA', fg: '#ffffff' },
  telecel: { bg: '#E10600', fg: '#ffffff' },
  malitel: { bg: '#6B2D90', fg: '#ffffff' },
  mtn: { bg: '#FFCC00', fg: '#1A1A1A' },
};

/**
 * Un moyen = un opérateur dans un pays.
 * MTN n’opère pas au Mali (Orange + Malitel seulement).
 * Au Sénégal, parmi ces réseaux, seul Orange Money est présent.
 * En Guinée : Orange Money et MTN Mobile Money.
 */
export const COUNTRY_PAYMENT_METHODS: CountryPaymentMethod[] = [
  {
    id: 'orange_bf',
    brand: 'orange',
    country: 'BF',
    label: 'Orange Money Burkina',
    hint: 'Orange Burkina Faso',
    dial: '+226',
  },
  {
    id: 'moov_bf',
    brand: 'moov',
    country: 'BF',
    label: 'Moov Money Burkina',
    hint: 'Moov Africa Burkina',
    dial: '+226',
  },
  {
    id: 'telecel_bf',
    brand: 'telecel',
    country: 'BF',
    label: 'Telecel Money Burkina',
    hint: 'Telecel Faso',
    dial: '+226',
  },
  {
    id: 'orange_ml',
    brand: 'orange',
    country: 'ML',
    label: 'Orange Money Mali',
    hint: 'Orange Mali',
    dial: '+223',
  },
  {
    id: 'malitel_ml',
    brand: 'malitel',
    country: 'ML',
    label: 'Malitel Money',
    hint: 'Moov Africa Malitel',
    dial: '+223',
  },
  {
    id: 'orange_sn',
    brand: 'orange',
    country: 'SN',
    label: 'Orange Money Sénégal',
    hint: 'Orange Sénégal',
    dial: '+221',
  },
  {
    id: 'orange_gn',
    brand: 'orange',
    country: 'GN',
    label: 'Orange Money Guinée',
    hint: 'Orange Guinée',
    dial: '+224',
  },
  {
    id: 'mtn_gn',
    brand: 'mtn',
    country: 'GN',
    label: 'MTN Mobile Money Guinée',
    hint: 'MTN Guinée',
    dial: '+224',
  },
];

export const ACCEPTED_PAYMENT_NAMES = [
  'Orange Money',
  'Moov Money',
  'Telecel Money',
  'Malitel',
  'MTN MoMo',
] as const;

const LEGACY_LABELS: Record<string, string> = {
  mobile_money: 'Mobile Money',
  orange_money: 'Orange Money',
  moov_money: 'Moov Money',
  mtn_money: 'MTN Money',
  wave: 'Wave',
  telecel_money: 'Telecel Money',
  malitel: 'Malitel Money',
};

export function paymentMethodsForCountry(country?: string | null): CountryPaymentMethod[] {
  return COUNTRY_PAYMENT_METHODS.filter((m) => m.country === country);
}

export function paymentMethodById(id?: string | null): CountryPaymentMethod | undefined {
  if (!id) return undefined;
  return COUNTRY_PAYMENT_METHODS.find((m) => m.id === id);
}

export function paymentMethodLabel(id?: string | null): string {
  if (!id) return 'Mobile Money';
  return paymentMethodById(id)?.label || LEGACY_LABELS[id] || 'Mobile Money';
}
