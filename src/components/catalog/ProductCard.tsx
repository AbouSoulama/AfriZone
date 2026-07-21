import { Link } from 'react-router-dom';
import { Star, CheckCircle, Award, Tag } from 'lucide-react';
import type { CatalogProduct } from '../../types/catalog';
import { formatPrice } from '../../services/catalog';

interface ProductCardProps {
  product: CatalogProduct;
}

export default function ProductCard({ product }: ProductCardProps) {
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
      className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 block"
    >
      <div className="relative overflow-hidden bg-gray-50">
        <img
          src={image}
          alt={product.name}
          className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
          loading="lazy"
        />
        {discount != null && (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-extrabold text-white shadow-md bg-[#FF6B00]">
            -{discount}%
          </span>
        )}
        {product.isFeatured && !discount && (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-extrabold text-white shadow-md bg-[#00A651]">
            Vedette
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center gap-1 mb-2">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={12}
                className={
                  s <= Math.round(product.rating)
                    ? 'text-[#FFD700] fill-[#FFD700]'
                    : 'text-gray-200'
                }
              />
            ))}
          </div>
          <span className="text-xs font-semibold text-gray-500">({product.reviewCount})</span>
        </div>

        <h3 className="text-sm font-bold text-[#1F2937] mb-2 line-clamp-2 min-h-[40px] group-hover:text-[#FF6B00] transition-colors">
          {product.name}
        </h3>

        <div className="mb-3">
          <p className="text-lg font-extrabold text-[#FF6B00]">
            {formatPrice(product.price, product.currency)}
          </p>
          {product.oldPrice != null && (
            <p className="text-xs text-gray-400 line-through">
              {formatPrice(product.oldPrice, product.currency)}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5 min-w-0">
            {product.vendor?.status === 'approved' && (
              <span className="flex items-center gap-1 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full shrink-0">
                <CheckCircle size={10} className="text-[#00A651]" />
                <span className="text-[10px] font-bold text-[#00A651]">Vérifié</span>
              </span>
            )}
            {product.vendor && product.vendor.rating >= 4.8 && (
              <span className="hidden sm:flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                <Award size={10} className="text-yellow-500" />
                <span className="text-[10px] font-bold text-yellow-700">Top</span>
              </span>
            )}
            <span className="text-xs font-semibold text-gray-600 truncate">
              {product.vendor?.shopName ?? 'Vendeur'}
            </span>
          </div>
          {product.vendor?.city && (
            <span className="text-[10px] text-gray-400 flex items-center gap-0.5 shrink-0">
              <Tag size={10} /> {product.vendor.city}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
