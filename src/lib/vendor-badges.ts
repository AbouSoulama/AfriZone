import type { CatalogVendor } from '../types/catalog';

export type VendorBadge = 'verified' | 'gold' | 'top_rated';

export function resolveVendorBadges(
  vendor: Pick<
    CatalogVendor,
    'status' | 'rating' | 'reviewCount' | 'totalSales' | 'isGoldSeller' | 'isTopRated'
  >
): VendorBadge[] {
  const badges: VendorBadge[] = [];
  if (vendor.status === 'approved') badges.push('verified');

  const gold =
    vendor.isGoldSeller === true || (vendor.totalSales ?? 0) >= 50;
  if (gold) badges.push('gold');

  const top =
    vendor.isTopRated === true ||
    ((vendor.rating ?? 0) >= 4.5 && (vendor.reviewCount ?? 0) >= 5);
  if (top) badges.push('top_rated');

  return badges;
}
