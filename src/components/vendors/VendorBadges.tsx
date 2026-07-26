import { Award, CheckCircle, Crown } from 'lucide-react';
import type { CatalogVendor } from '../../types/catalog';
import { resolveVendorBadges, type VendorBadge } from '../../lib/vendor-badges';

const META: Record<
  VendorBadge,
  { label: string; className: string; Icon: typeof CheckCircle }
> = {
  verified: {
    label: 'Vérifié',
    className: 'bg-green-50 text-[#00A651] border-green-200',
    Icon: CheckCircle,
  },
  gold: {
    label: 'Gold Seller',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    Icon: Crown,
  },
  top_rated: {
    label: 'Top Rated',
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    Icon: Award,
  },
};

export default function VendorBadges({
  vendor,
  size = 'md',
}: {
  vendor: Pick<
    CatalogVendor,
    'status' | 'rating' | 'reviewCount' | 'totalSales' | 'isGoldSeller' | 'isTopRated'
  >;
  size?: 'sm' | 'md';
}) {
  const badges = resolveVendorBadges(vendor);
  if (!badges.length) return null;

  const pad = size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[10px]';
  const icon = size === 'sm' ? 10 : 12;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {badges.map((b) => {
        const m = META[b];
        const Icon = m.Icon;
        return (
          <span
            key={b}
            className={`inline-flex items-center gap-1 rounded-full border font-extrabold uppercase tracking-wide ${pad} ${m.className}`}
          >
            <Icon
              size={icon}
              className={b === 'top_rated' || b === 'gold' ? 'fill-current' : ''}
            />
            {m.label}
          </span>
        );
      })}
    </div>
  );
}
