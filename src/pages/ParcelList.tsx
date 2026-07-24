import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../services/catalog';
import {
  fetchMyParcels,
  PARCEL_STATUS_LABELS,
  PARCEL_TYPE_LABELS,
  type ParcelType,
  type ParcelView,
} from '../services/parcels';

export default function ParcelListPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [parcels, setParcels] = useState<ParcelView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchMyParcels(user.id)
      .then(setParcels)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  if (!authLoading && !isAuthenticated) {
    return <Navigate to="/auth/login" replace state={{ from: '/colis/mes-envois' }} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl md:text-3xl font-extrabold">Mes envois</h1>
          <Link
            to="/colis"
            className="inline-flex px-4 py-2.5 bg-[#FF6B00] text-white rounded-xl text-sm font-bold"
          >
            Nouvel envoi
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="h-32 bg-white rounded-2xl border animate-pulse" />
        ) : parcels.length === 0 ? (
          <div className="bg-white border rounded-2xl p-10 text-center">
            <p className="text-gray-600 mb-4">Aucun colis pour le moment.</p>
            <Link to="/colis" className="text-[#FF6B00] font-bold">
              Envoyer un colis
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {parcels.map((p) => (
              <Link
                key={p.id}
                to={`/colis/${p.id}`}
                className="block bg-white border border-gray-100 rounded-2xl p-5 hover:border-[#FF6B00] transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="font-mono font-bold text-[#FF6B00]">{p.trackingNumber}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {p.pickupCity} → {p.deliveryCity} ·{' '}
                      {PARCEL_TYPE_LABELS[p.parcelType as ParcelType] || p.parcelType}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(p.createdAt).toLocaleString('fr-FR')}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="inline-block text-xs font-bold px-2 py-1 rounded-full bg-orange-50 text-[#FF6B00]">
                      {PARCEL_STATUS_LABELS[p.status]}
                    </span>
                    <p className="font-extrabold mt-1">{formatPrice(p.price)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
