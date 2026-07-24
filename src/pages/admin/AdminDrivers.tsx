import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchDriversForAdmin,
  getDriverDocumentUrl,
  updateDriverStatus,
  type AdminDriverRow,
} from '../../services/admin-drivers';
import { VEHICLE_LABELS, type VehicleType } from '../../services/drivers';
import type { VendorStatus } from '../../types/auth';

const FILTERS: { key: VendorStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'pending', label: 'En attente' },
  { key: 'approved', label: 'Approuvés' },
  { key: 'rejected', label: 'Refusés' },
  { key: 'suspended', label: 'Suspendus' },
];

export default function AdminDriversPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<VendorStatus | 'all'>('pending');
  const [rows, setRows] = useState<AdminDriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await fetchDriversForAdmin(filter));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  const onStatus = async (id: string, status: VendorStatus) => {
    if (!user) return;
    let reason: string | undefined;
    if (status === 'rejected') {
      reason = prompt('Motif du refus ?') || undefined;
      if (!reason) return;
    }
    setBusyId(id);
    try {
      await updateDriverStatus(id, status, user.id, reason);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusyId(null);
    }
  };

  const openDoc = async (path: string | null) => {
    if (!path) return;
    const url = await getDriverDocumentUrl(path);
    if (url) window.open(url, '_blank');
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">Livreurs</h1>
      <p className="text-sm text-gray-500 mb-6">Validez les candidatures livreurs.</p>

      <div className="flex gap-2 overflow-x-auto mb-5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
              filter === f.key ? 'bg-[#FF6B00] text-white' : 'bg-white border border-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-40 bg-white rounded-2xl border animate-pulse" />
      ) : rows.length === 0 ? (
        <div className="bg-white border rounded-2xl p-10 text-center text-gray-500">
          Aucun livreur.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((d) => (
            <div
              key={d.id}
              className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div>
                <p className="font-mono font-bold text-[#FF6B00]">{d.driverCode}</p>
                <p className="text-sm font-semibold mt-0.5">{d.ownerName}</p>
                <p className="text-xs text-gray-500">
                  {d.ownerPhone} · {d.city} ·{' '}
                  {VEHICLE_LABELS[d.vehicleType as VehicleType] || d.vehicleType}
                  {d.vehiclePlate ? ` (${d.vehiclePlate})` : ''}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Zones : {d.zones.join(', ') || '—'} · {d.totalDeliveries} courses
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {d.idDocumentUrl && (
                  <button
                    type="button"
                    onClick={() => openDoc(d.idDocumentUrl)}
                    className="px-3 py-2 border rounded-xl text-xs font-bold"
                  >
                    Voir pièce
                  </button>
                )}
                {d.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      disabled={busyId === d.id}
                      onClick={() => onStatus(d.id, 'approved')}
                      className="px-3 py-2 bg-[#00A651] text-white rounded-xl text-xs font-bold disabled:opacity-50"
                    >
                      Approuver
                    </button>
                    <button
                      type="button"
                      disabled={busyId === d.id}
                      onClick={() => onStatus(d.id, 'rejected')}
                      className="px-3 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-bold"
                    >
                      Refuser
                    </button>
                  </>
                )}
                {d.status === 'approved' && (
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={() => onStatus(d.id, 'suspended')}
                    className="px-3 py-2 border rounded-xl text-xs font-bold"
                  >
                    Suspendre
                  </button>
                )}
                {(d.status === 'suspended' || d.status === 'rejected') && (
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={() => onStatus(d.id, 'approved')}
                    className="px-3 py-2 bg-[#00A651] text-white rounded-xl text-xs font-bold"
                  >
                    Réactiver
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
