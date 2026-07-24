import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../services/catalog';
import {
  cancelParcel,
  fetchMyParcelById,
  PARCEL_STATUS_LABELS,
  PARCEL_TIMELINE,
  PARCEL_TYPE_LABELS,
  type ParcelStatus,
  type ParcelType,
  type ParcelView,
} from '../services/parcels';

function timelineIndex(status: ParcelStatus): number {
  if (status === 'cancelled') return -1;
  return PARCEL_TIMELINE.indexOf(status);
}

export default function ParcelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [parcel, setParcel] = useState<ParcelView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user || !id) return;
    setLoading(true);
    try {
      setParcel(await fetchMyParcelById(user.id, id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user, id]);

  if (!authLoading && !isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  const currentIdx = parcel ? timelineIndex(parcel.status) : -1;

  const onCancel = async () => {
    if (!user || !parcel) return;
    if (!confirm('Annuler cet envoi ?')) return;
    setBusy(true);
    try {
      await cancelParcel(user.id, parcel.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link
          to="/colis/mes-envois"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#FF6B00] mb-6"
        >
          <ArrowLeft size={16} /> Mes envois
        </Link>

        {loading && <div className="h-40 bg-white rounded-2xl border animate-pulse" />}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
            {error}
          </div>
        )}
        {!loading && !parcel && (
          <div className="bg-white border rounded-2xl p-8 text-center text-gray-500">
            Colis introuvable.
          </div>
        )}

        {parcel && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                <div>
                  <p className="font-mono font-bold text-[#FF6B00] text-lg">
                    {parcel.trackingNumber}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(parcel.createdAt).toLocaleString('fr-FR')}
                  </p>
                </div>
                <span className="inline-block text-xs font-bold px-3 py-1 rounded-full bg-orange-50 text-[#FF6B00]">
                  {PARCEL_STATUS_LABELS[parcel.status]}
                </span>
              </div>

              {parcel.status !== 'cancelled' && (
                <div className="flex items-center justify-between gap-1 overflow-x-auto py-4">
                  {PARCEL_TIMELINE.map((step, idx) => {
                    const done = currentIdx >= idx;
                    return (
                      <div key={step} className="flex-1 min-w-[64px] text-center">
                        <div
                          className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center mb-1 ${
                            done ? 'bg-[#00A651] text-white' : 'bg-gray-200 text-gray-400'
                          }`}
                        >
                          {done ? <Check size={14} /> : idx + 1}
                        </div>
                        <p className="text-[9px] font-semibold text-gray-600 leading-tight">
                          {PARCEL_STATUS_LABELS[step]}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-6 text-sm space-y-2">
              <h2 className="font-extrabold mb-2">Itinéraire</h2>
              <p>
                <span className="text-gray-500">De :</span> {parcel.senderName} —{' '}
                {parcel.pickupAddress}, {parcel.pickupCity} ({parcel.senderPhone})
              </p>
              <p>
                <span className="text-gray-500">Vers :</span> {parcel.recipientName} —{' '}
                {parcel.deliveryAddress}, {parcel.deliveryCity} ({parcel.recipientPhone})
              </p>
              <p>
                <span className="text-gray-500">Type :</span>{' '}
                {PARCEL_TYPE_LABELS[parcel.parcelType as ParcelType] || parcel.parcelType} ·{' '}
                {parcel.weightKg} kg
              </p>
              <p>
                <span className="text-gray-500">Contenu :</span> {parcel.contentDescription}
              </p>
              <p>
                <span className="text-gray-500">Prix :</span>{' '}
                <strong className="text-[#FF6B00]">{formatPrice(parcel.price)}</strong> ·{' '}
                {parcel.paymentStatus === 'paid' ? 'Payé' : 'En attente'}
              </p>
              {parcel.specialInstructions && (
                <p>
                  <span className="text-gray-500">Notes :</span> {parcel.specialInstructions}
                </p>
              )}
            </div>

            <Link
              to={`/suivi?n=${encodeURIComponent(parcel.trackingNumber)}`}
              className="block text-center py-3 border-2 border-gray-200 rounded-xl font-bold text-sm hover:border-[#FF6B00]"
            >
              Ouvrir le suivi public
            </Link>

            {(parcel.status === 'received' || parcel.status === 'pickup_scheduled') && (
              <button
                onClick={onCancel}
                disabled={busy}
                className="w-full py-3 border-2 border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 disabled:opacity-50"
              >
                Annuler l&apos;envoi
              </button>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
