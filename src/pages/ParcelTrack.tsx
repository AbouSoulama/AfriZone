import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Package, Search } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import {
  fetchParcelByTracking,
  PARCEL_STATUS_LABELS,
  PARCEL_TIMELINE,
  type ParcelStatus,
  type ParcelView,
} from '../services/parcels';

function timelineIndex(status: ParcelStatus): number {
  if (status === 'cancelled') return -1;
  return PARCEL_TIMELINE.indexOf(status);
}

export default function ParcelTrackPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('n') || '');
  const [parcel, setParcel] = useState<ParcelView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const runSearch = async (tracking: string) => {
    const n = tracking.trim();
    if (!n) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    setParams({ n });
    try {
      const data = await fetchParcelByTracking(n);
      setParcel(data);
      if (!data) setError('Aucun colis trouvé pour ce numéro.');
    } catch (e) {
      setParcel(null);
      setError(e instanceof Error ? e.message : 'Erreur de suivi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const n = params.get('n');
    if (n) {
      setQuery(n);
      runSearch(n);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentIdx = parcel ? timelineIndex(parcel.status) : -1;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-50 text-[#00A651] mb-3">
            <Package size={28} />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold">Suivre un colis</h1>
          <p className="text-sm text-gray-500 mt-1">Entrez le numéro de suivi AfriZone</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(query);
          }}
          className="flex gap-2 mb-6"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="AZC-260724-XXXXXX"
            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none font-mono text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-3 bg-[#FF6B00] hover:bg-[#E05E00] text-white rounded-xl font-bold inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Search size={18} /> {loading ? '...' : 'Suivre'}
          </button>
        </form>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
            {error}
          </div>
        )}

        {parcel && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="font-mono font-bold text-[#FF6B00] text-lg">{parcel.trackingNumber}</p>
                <p className="text-sm text-gray-500">
                  {parcel.pickupCity} → {parcel.deliveryCity}
                </p>
              </div>
              <span className="inline-block text-xs font-bold px-3 py-1 rounded-full bg-orange-50 text-[#FF6B00] w-fit">
                {PARCEL_STATUS_LABELS[parcel.status]}
              </span>
            </div>

            {parcel.status !== 'cancelled' && (
              <div className="flex items-center justify-between gap-1 overflow-x-auto py-2">
                {PARCEL_TIMELINE.map((step, idx) => {
                  const done = currentIdx >= idx;
                  return (
                    <div key={step} className="flex-1 min-w-[56px] text-center">
                      <div
                        className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center mb-1 ${
                          done ? 'bg-[#00A651] text-white' : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        {done ? <Check size={12} /> : idx + 1}
                      </div>
                      <p className="text-[9px] font-semibold text-gray-600 leading-tight">
                        {PARCEL_STATUS_LABELS[step]}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="text-sm space-y-1 border-t pt-4">
              <p>
                <span className="text-gray-500">Destinataire :</span> {parcel.recipientName}
              </p>
              <p>
                <span className="text-gray-500">Ville livraison :</span> {parcel.deliveryCity}
              </p>
              <p className="text-xs text-gray-400">
                Mis à jour le {new Date(parcel.updatedAt).toLocaleString('fr-FR')}
              </p>
            </div>
          </div>
        )}

        {searched && !parcel && !error && !loading && (
          <p className="text-center text-gray-500 text-sm">Aucun résultat.</p>
        )}

        <p className="text-center mt-8">
          <Link to="/colis" className="text-[#FF6B00] font-bold text-sm">
            Envoyer un colis
          </Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}
