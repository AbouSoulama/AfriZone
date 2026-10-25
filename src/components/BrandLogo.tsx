import { Link } from 'react-router-dom';

type BrandLogoProps = {
  to?: string | null;
  /** Hauteur visuelle du logo (classes Tailwind) */
  className?: string;
  /** Variante d’usage */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Fond sombre : halo discret pour faire ressortir le logo */
  onDark?: boolean;
};

const SIZE: Record<NonNullable<BrandLogoProps['size']>, string> = {
  sm: 'h-9',
  md: 'h-12',
  lg: 'h-16',
  xl: 'h-20',
};

/**
 * Logo AfriZone sans cadre rectangle blanc.
 * Le fichier PNG est transparent et recadré autour du symbole.
 */
export default function BrandLogo({
  to = '/',
  className = '',
  size = 'md',
  onDark = false,
}: BrandLogoProps) {
  const img = (
    <img
      src="/logo-afrizone.png"
      alt="AfriZone"
      className={`${SIZE[size]} w-auto object-contain ${
        onDark ? 'drop-shadow-[0_8px_20px_rgba(0,0,0,0.35)]' : 'drop-shadow-[0_6px_14px_rgba(255,107,0,0.2)]'
      } ${className}`}
      decoding="async"
    />
  );

  if (!to) return img;

  return (
    <Link
      to={to}
      className="inline-flex items-center shrink-0 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/40 rounded-xl"
      aria-label="AfriZone — Accueil"
    >
      {img}
    </Link>
  );
}
