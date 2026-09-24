import type {
  CatalogProduct,
  DeliveryMode,
  HandoverMethod,
  ProductApprovalStatus,
  ProductReception,
} from '../types/catalog';

export type ProductRow = Record<string, unknown>;

function num(value: unknown): number | null {
  return value != null ? Number(value) : null;
}

function str(value: unknown): string | null {
  return (value as string) ?? null;
}

export function mapProductReception(row: ProductRow): ProductReception {
  return {
    handoverMethod: (row.handover_method as HandoverMethod) ?? null,
    warehouseCity: str(row.warehouse_city),
    expectedDropoffAt: str(row.expected_dropoff_at),
    packageCount: num(row.package_count),
    packageWeightKg: num(row.package_weight_kg),
    packageLengthCm: num(row.package_length_cm),
    packageWidthCm: num(row.package_width_cm),
    packageHeightCm: num(row.package_height_cm),
    contactName: str(row.reception_contact_name),
    contactPhone: str(row.reception_contact_phone),
    notes: str(row.reception_notes),
  };
}

/**
 * Mappe une ligne `products` vers `CatalogProduct` (sans le vendeur lié).
 * Les services ajoutent ensuite leurs champs propres (vendor, vendorName…).
 */
export function mapProductRow(row: ProductRow): CatalogProduct {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    description: str(row.description),
    category: row.category as string,
    subcategory: str(row.subcategory),
    price: Number(row.price),
    oldPrice: num(row.old_price),
    currency: (row.currency as string) || 'FCFA',
    stock: Number(row.stock ?? 0),
    condition: (row.condition as string) || 'neuf',
    weightKg: num(row.weight_kg),
    deliveryMode: row.delivery_mode as DeliveryMode,
    deliveryZones: (row.delivery_zones as string[]) ?? null,
    vendorDeliveryFee: num(row.vendor_delivery_fee),
    images: (row.images as string[]) ?? [],
    mainImage: str(row.main_image),
    realImages: (row.real_images as string[]) ?? [],
    rating: Number(row.rating ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    soldCount: Number(row.sold_count ?? 0),
    isActive: Boolean(row.is_active),
    isFeatured: Boolean(row.is_featured),
    tags: (row.tags as string[]) ?? [],
    createdAt: row.created_at as string,
    approvalStatus: (row.approval_status as ProductApprovalStatus) ?? 'approved',
    approvalRequestedAt: str(row.approval_requested_at),
    approvedAt: str(row.approved_at),
    rejectionReason: str(row.rejection_reason),
    reception: mapProductReception(row),
  };
}

/** Colonnes de réception entrepôt à écrire côté `products`. */
export interface ReceptionInput {
  handoverMethod?: HandoverMethod | null;
  warehouseCity?: string | null;
  expectedDropoffAt?: string | null;
  packageCount?: number | null;
  packageWeightKg?: number | null;
  packageLengthCm?: number | null;
  packageWidthCm?: number | null;
  packageHeightCm?: number | null;
  contactName?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
}

export function receptionPayload(input: ReceptionInput = {}): Record<string, unknown> {
  return {
    handover_method: input.handoverMethod ?? null,
    warehouse_city: input.warehouseCity?.trim() || null,
    expected_dropoff_at: input.expectedDropoffAt || null,
    package_count: input.packageCount ?? null,
    package_weight_kg: input.packageWeightKg ?? null,
    package_length_cm: input.packageLengthCm ?? null,
    package_width_cm: input.packageWidthCm ?? null,
    package_height_cm: input.packageHeightCm ?? null,
    reception_contact_name: input.contactName?.trim() || null,
    reception_contact_phone: input.contactPhone?.trim() || null,
    reception_notes: input.notes?.trim() || null,
  };
}
