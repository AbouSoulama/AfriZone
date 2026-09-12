import { useEffect, useState } from 'react';
import { CheckCircle, Clock, Wallet, XCircle } from 'lucide-react';
import {
  adminReviewWithdrawal,
  fetchWithdrawalsForAdmin,
  PAYOUT_PROVIDER_LABELS,
  WITHDRAWAL_STATUS_LABELS,
  type PayoutProvider,
  type WithdrawalRequest,
  type WithdrawalStatus,
} from '../../services/driver-wallet';
import { formatPrice } from '../../services/catalog';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminWithdrawalsPage() {
  const [rows, setRows] = useState<WithdrawalRequest[]>([]);
  const [filter, setFilter] = useState<WithdrawalStatus | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refById, setRefById] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchWithdrawalsForAdmin(filter));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [filter]);

  const review = async (
    id: string,
    action: 'approve' | 'paid' | 'reject'
  ) => {
    setBusyId(id);
    setError(null);
    try {
      await adminReviewWithdrawal({
        withdrawalId: id,
        action,
        paymentReference: refById[id]?.trim() || undefined,
        adminNote: action === 'reject' ? 'Refusé par admin' : undefined,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-[#FF6B00] text-xs font-bold mb-1">
            <Wallet size={14} /> PORTEFEUILLE LIVREURS
          </div>
          <h1 className="text-2xl font-extrabold">Retraits livreurs</h1>
          <p className="text-sm text-gray-500 mt-1">
            Validez et marquez comme payés les retraits Mobile Money / Wave (fenêtre ven–dim).
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as WithdrawalStatus | 'all')}
          className="px-4 py-2.5 border-2 border-gray-200 rounded-xl bg-white text-sm font-semibold"
        >
          <option value="all">Tous</option>
          <option value="pending">En attente</option>
          <option value="approved">Approuvées</option>
          <option value="paid">Payées</option>
          <option value="rejected">Refusées</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Chargement…</p>
      ) : rows.length === 0 ? (
        <div className="bg-white border rounded-2xl p-10 text-center text-gray-500">
          Aucune demande pour ce filtre.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((w) => (
            <div
              key={w.id}
              className="bg-white border border-gray-100 rounded-2xl p-4 md:p-5 flex flex-col gap-3"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div>
                  <p className="font-extrabold">
                    {w.ownerName || 'Livreur'}{' '}
                    <span className="text-gray-400 font-semibold text-sm">
                      {w.driverCode ? `· ${w.driverCode}` : ''}
                    </span>
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {w.provider
                      ? PAYOUT_PROVIDER_LABELS[w.provider as PayoutProvider] || w.provider
                      : '—'}{' '}
                    · {w.phone || '—'} · {w.driverCity || '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(w.createdAt)} · semaine {w.weekKey}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-extrabold text-[#FF6B00]">
                    {formatPrice(w.amount)}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 mt-1 text-xs font-bold px-2 py-1 rounded-full ${
                      w.status === 'paid'
                        ? 'bg-green-50 text-green-700'
                        : w.status === 'rejected'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {w.status === 'pending' && <Clock size={12} />}
                    {w.status === 'paid' && <CheckCircle size={12} />}
                    {w.status === 'rejected' && <XCircle size={12} />}
                    {WITHDRAWAL_STATUS_LABELS[w.status]}
                  </span>
                </div>
              </div>

              {(w.status === 'pending' || w.status === 'approved') && (
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center border-t pt-3">
                  <input
                    value={refById[w.id] || ''}
                    onChange={(e) =>
                      setRefById((prev) => ({ ...prev, [w.id]: e.target.value }))
                    }
                    placeholder="Réf. virement (ex. OM-…)"
                    className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm"
                  />
                  {w.status === 'pending' && (
                    <button
                      disabled={busyId === w.id}
                      onClick={() => review(w.id, 'approve')}
                      className="px-4 py-2 bg-gray-800 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                    >
                      Approuver
                    </button>
                  )}
                  <button
                    disabled={busyId === w.id}
                    onClick={() => review(w.id, 'paid')}
                    className="px-4 py-2 bg-[#00A651] text-white rounded-xl text-sm font-bold disabled:opacity-50"
                  >
                    Marquer payé
                  </button>
                  <button
                    disabled={busyId === w.id}
                    onClick={() => review(w.id, 'reject')}
                    className="px-4 py-2 bg-red-50 text-red-700 rounded-xl text-sm font-bold disabled:opacity-50"
                  >
                    Refuser
                  </button>
                </div>
              )}

              {w.paymentReference && (
                <p className="text-xs text-gray-500">Réf. : {w.paymentReference}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
