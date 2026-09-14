/** Commission marketplace AfriZone prélevée sur le prix produit vendeur. */
export const PLATFORM_COMMISSION_RATE = 0.1;

export function platformFeeFromPrice(price: number, rate = PLATFORM_COMMISSION_RATE): number {
  const p = Math.max(0, Number(price) || 0);
  return Math.round(p * rate);
}

export function vendorNetFromPrice(price: number, rate = PLATFORM_COMMISSION_RATE): number {
  const p = Math.max(0, Number(price) || 0);
  return Math.max(0, Math.round(p - platformFeeFromPrice(p, rate)));
}

export function formatCommissionHint(price: number): string {
  const fee = platformFeeFromPrice(price);
  const net = vendorNetFromPrice(price);
  if (price <= 0) {
    return `AfriZone prélève ${(PLATFORM_COMMISSION_RATE * 100).toFixed(0)} % sur chaque vente.`;
  }
  return `Commission AfriZone ${(PLATFORM_COMMISSION_RATE * 100).toFixed(0)} % = ${fee.toLocaleString('fr-FR')} F · Vous recevez ${net.toLocaleString('fr-FR')} F`;
}
