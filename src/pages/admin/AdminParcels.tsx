import { useEffect, useState } from 'react';
import { formatPrice } from '../../services/catalog';
import {
  fetchAllParcelsAdmin,
  nextParcelStatus,
  PARCEL_STATUS_LABELS,
  updateParcelStatusAdmin,
  type ParcelView,
} from '../../services/parcels';

export default function AdminParcelsPage() {
  const [parcels, setParcels] = useState<ParcelView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setParcels(await fetchAllParcelsAdmin());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onAdvance = async (parcel: ParcelView) => {
    const next = nextParcelStatus(parcel.status);
    if (!next) return;
    setBusyId(parcel.id);
    try {
      await updateParcelStatusAdmin(parcel.id, next);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-[#1F2937] mb-2">Colis</h1>
      <p className="text-sm text-gray-500 mb-6">
        Faites avancer le statut des envois (enlèvement → livraison).
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-40 bg-white rounded-2xl border animate-pulse" />
      ) : parcels.length === 0 ? (
        <div className="bg-white border rounded-2xl p-10 text-center text-gray-500">
          Aucun colis.
        </div>
      ) : (
        <div className="space-y-3">
          {parcels.map((p) => {
            const next = nextParcelStatus(p.status);
            return (
              <div
                key={p.id}
                className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div>
                  <p className="font-mono font-bold text-[#FF6B00]">{p.trackingNumber}</p>
                  <p className="text-sm text-gray-500">
                    {p.pickupCity} → {p.deliveryCity} · {p.senderName} → {p.recipientName}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(p.createdAt).toLocaleString('fr-FR')} · {formatPrice(p.price)} ·{' '}
                    {p.paymentStatus === 'paid' ? 'Payé' : 'En attente'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-orange-50 text-[#FF6B00]">
                    {PARCEL_STATUS_LABELS[p.status]}
                  </span>
                  {next && (
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => onAdvance(p)}
                      className="px-3 py-2 bg-[#00A651] hover:bg-[#008A43] disabled:opacity-50 text-white rounded-xl text-xs font-bold"
                    >
                      → {PARCEL_STATUS_LABELS[next]}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
