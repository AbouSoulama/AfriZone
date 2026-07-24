import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  readOnly?: boolean;
  label?: string;
}

export function StarRating({
  value,
  onChange,
  size = 18,
  readOnly = false,
  label,
}: StarRatingProps) {
  return (
    <div className="inline-flex flex-col gap-1">
      {label && <span className="text-xs font-semibold text-gray-600">{label}</span>}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => {
          const filled = s <= Math.round(value);
          if (readOnly || !onChange) {
            return (
              <Star
                key={s}
                size={size}
                className={filled ? 'text-[#FFD700] fill-[#FFD700]' : 'text-gray-200'}
              />
            );
          }
          return (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className="p-0.5 hover:scale-110 transition-transform"
              aria-label={`${s} étoile${s > 1 ? 's' : ''}`}
            >
              <Star
                size={size}
                className={
                  s <= value ? 'text-[#FFD700] fill-[#FFD700]' : 'text-gray-300 hover:text-[#FFD700]'
                }
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ReviewCard({
  authorName,
  rating,
  vendorRating,
  comment,
  createdAt,
  productName,
}: {
  authorName: string;
  rating: number;
  vendorRating?: number;
  comment: string | null;
  createdAt: string;
  productName?: string | null;
}) {
  return (
    <article className="bg-white border border-gray-100 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-bold text-sm text-[#1F2937]">{authorName}</p>
          {productName && (
            <p className="text-xs text-gray-500 mt-0.5">Produit : {productName}</p>
          )}
        </div>
        <time className="text-[11px] text-gray-400 shrink-0">
          {new Date(createdAt).toLocaleDateString('fr-FR')}
        </time>
      </div>
      <div className="flex flex-wrap items-center gap-4 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-500">Produit</span>
          <StarRating value={rating} size={14} readOnly />
        </div>
        {vendorRating != null && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-500">Vendeur</span>
            <StarRating value={vendorRating} size={14} readOnly />
          </div>
        )}
      </div>
      {comment ? (
        <p className="text-sm text-gray-600 leading-relaxed">{comment}</p>
      ) : (
        <p className="text-sm text-gray-400 italic">Sans commentaire</p>
      )}
    </article>
  );
}
