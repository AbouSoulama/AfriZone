import { useState } from 'react';
import { StarRating } from './StarRating';
import { submitReview, type ReviewView } from '../../services/reviews';

interface ReviewFormProps {
  orderId: string;
  productId: string;
  productName: string;
  existing?: ReviewView | null;
  onSaved: (review: ReviewView) => void;
}

export default function ReviewForm({
  orderId,
  productId,
  productName,
  existing,
  onSaved,
}: ReviewFormProps) {
  const [rating, setRating] = useState(existing?.rating || 0);
  const [vendorRating, setVendorRating] = useState(existing?.vendorRating || 0);
  const [comment, setComment] = useState(existing?.comment || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (rating < 1 || vendorRating < 1) {
      setError('Merci de noter le produit et le vendeur.');
      return;
    }
    setBusy(true);
    try {
      const id = await submitReview({
        orderId,
        productId,
        rating,
        vendorRating,
        comment: comment.trim() || undefined,
      });
      onSaved({
        id,
        userId: '',
        productId,
        vendorId: '',
        orderId,
        rating,
        vendorRating,
        comment: comment.trim() || null,
        createdAt: new Date().toISOString(),
        authorName: 'Vous',
      });
      setOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’envoi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="bg-orange-50/60 border border-orange-100 rounded-xl p-4 mt-2">
      <p className="text-sm font-bold text-[#1F2937] mb-3">
        {existing ? 'Modifier votre avis' : 'Noter'} — {productName}
      </p>

      <div className="flex flex-wrap gap-6 mb-3">
        <StarRating label="Produit" value={rating} onChange={setRating} size={22} />
        <StarRating label="Vendeur" value={vendorRating} onChange={setVendorRating} size={22} />
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={800}
        placeholder="Votre expérience (optionnel)…"
        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-[#FF6B00] focus:outline-none mb-3 resize-none"
      />

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {ok && <p className="text-sm text-green-700 mb-2">Avis enregistré. Merci !</p>}

      <button
        type="submit"
        disabled={busy}
        className="px-4 py-2 bg-[#FF6B00] hover:bg-[#E05E00] disabled:opacity-50 text-white rounded-xl text-sm font-bold"
      >
        {busy ? 'Envoi…' : existing ? 'Mettre à jour' : 'Publier l’avis'}
      </button>
    </form>
  );
}
