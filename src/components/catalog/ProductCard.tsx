import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, BadgeCheck, Award, MapPin, ArrowUpRight, ImageOff } from 'lucide-react';
import type { CatalogProduct } from '../../types/catalog';
import { formatPrice } from '../../services/catalog';

interface ProductCardProps {
  product: CatalogProduct;
}

export default function ProductCard({ product }: ProductCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const image =
    product.mainImage ||
    product.images[0] ||
    'https://images.unsplash.com/photo-1560393464-5c69a73c5770?w=400&h=400&fit=crop';

  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
      : null;

  return (
    <Link
      to={`/produit/${product.slug}`}
      className="group relative bg-white rounded-3xl border border-black/[0.04] overflow-hidden hover:shadow-[0_30px_60px_-24px_rgba(16,24,40,0.35)] transition-all duration-500 hover:-translate-y-1.5 block"
    >
      <div className="sheen relative m-2 mb-0 rounded-[1.25rem] overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 aspect-square">
        {imageFailed ? (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff className="w-10 h-10 text-gray-300" />
          </div>
        ) : (
          <img
            src={image}
            alt={product.name}
            onError={() => setImageFailed(true)}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
            loading="lazy"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {discount != null && (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-extrabold text-white bg-gradient-to-r from-[#FF3D00] to-[#FF8A2B] shadow-glow-orange">
            -{discount}%
          </span>
        )}
        {product.isFeatured && !discount && (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-extrabold text-white bg-gradient-to-r from-[#00A651] to-emerald-400 shadow-glow-green">
            Vedette
          </span>
        )}

        <span className="absolute bottom-3 right-3 w-10 h-10 rounded-2xl glass flex items-center justify-center text-[#0B0F19] opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 shadow-lg">
          <ArrowUpRight size={18} />
        </span>
      </div>

      <div className="p-4 pt-3.5">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[11px] font-semibold text-gray-500 truncate">
            {product.vendor?.shopName ?? 'Vendeur'}
          </span>
          <span className="flex items-center gap-1 shrink-0 text-[11px] font-bold text-[#1F2937]">
            <Star size={12} className="text-[#FFC107] fill-[#FFC107]" />
            {product.rating ? product.rating.toFixed(1) : '—'}
            <span className="font-medium text-gray-400">({product.reviewCount})</span>
          </span>
        </div>

        <h3 className="text-[15px] font-bold text-[#0B0F19] leading-snug line-clamp-2 min-h-[42px] group-hover:text-[#FF6B00] transition-colors">
          {product.name}
        </h3>

        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <p className="text-xl font-extrabold font-display text-[#0B0F19] tracking-tight">
              {formatPrice(product.price, product.currency)}
            </p>
            {product.oldPrice != null && (
              <p className="text-xs text-gray-400 line-through">
                {formatPrice(product.oldPrice, product.currency)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-black/[0.05]">
          <div className="flex items-center gap-1.5 min-w-0">
            {product.vendor?.status === 'approved' && (
              <span className="flex items-center gap-1 bg-emerald-50 text-[#00A651] px-2 py-0.5 rounded-full shrink-0">
                <BadgeCheck size={12} />
                <span className="text-[10px] font-bold">Vérifié</span>
              </span>
            )}
            {product.vendor && product.vendor.rating >= 4.8 && (
              <span className="hidden sm:flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full shrink-0">
                <Award size={11} />
                <span className="text-[10px] font-bold">Top</span>
              </span>
            )}
          </div>
          {product.vendor?.city && (
            <span className="text-[11px] text-gray-400 flex items-center gap-1 shrink-0 font-medium">
              <MapPin size={11} /> {product.vendor.city}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
