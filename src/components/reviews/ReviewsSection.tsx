import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { ReviewCard } from './StarRating';
import { fetchProductReviews, fetchVendorReviews, type ReviewView } from '../../services/reviews';

interface ReviewsSectionProps {
  mode: 'product' | 'vendor';
  targetId: string;
  title?: string;
}

export default function ReviewsSection({ mode, targetId, title }: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<ReviewView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const loader = mode === 'product' ? fetchProductReviews : fetchVendorReviews;
    loader(targetId, 30).then((list) => {
      if (!cancelled) {
        setReviews(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mode, targetId]);

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare size={20} className="text-[#FF6B00]" />
        <h2 className="text-xl font-extrabold text-[#1F2937]">
          {title || 'Avis clients'}{' '}
          {!loading && <span className="text-[#FF6B00]">({reviews.length})</span>}
        </h2>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-2xl border animate-pulse" />
          ))}
        </div>
      )}

      {!loading && reviews.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center text-sm text-gray-500">
          Aucun avis pour le moment. Soyez le premier après une commande livrée.
        </div>
      )}

      {!loading && reviews.length > 0 && (
        <div className="space-y-3">
          {reviews.map((r) => (
            <ReviewCard
              key={r.id}
              authorName={r.authorName}
              rating={r.rating}
              vendorRating={r.vendorRating}
              comment={r.comment}
              createdAt={r.createdAt}
              productName={mode === 'vendor' ? r.productName : null}
            />
          ))}
        </div>
      )}
    </section>
  );
}
