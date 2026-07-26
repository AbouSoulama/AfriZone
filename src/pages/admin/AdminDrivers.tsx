import { useEffect, useState } from 'react';
import { Eye, Trash2 } from 'lucide-react';
import AdminModal from '../../components/admin/AdminModal';
import { DocPreview } from '../../components/admin/DocPreview';
import { useAuth } from '../../context/AuthContext';
import {
  deleteDriverAdmin,
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

const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente',
  approved: 'Approuvé',
  rejected: 'Refusé',
  suspended: 'Suspendu',
};

export default function AdminDriversPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<VendorStatus | 'all'>('all');
  const [rows, setRows] = useState<AdminDriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminDriverRow | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(false);

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
      if (selected?.id === id) {
        const refreshed = (await fetchDriversForAdmin('all')).find((x) => x.id === id);
        if (refreshed) setSelected(refreshed);
        else setSelected(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusyId(null);
    }
  };

  const openDetail = async (d: AdminDriverRow) => {
    setSelected(d);
    setDocUrl(null);
    if (d.idDocumentUrl) {
      setDocLoading(true);
      const url = await getDriverDocumentUrl(d.idDocumentUrl);
      setDocUrl(url);
      setDocLoading(false);
      if (!url) setError('Impossible de charger la pièce (exécutez 011_admin_management.sql).');
    }
  };

  const onDelete = async (d: AdminDriverRow) => {
    if (!confirm(`Supprimer le livreur ${d.driverCode} ?`)) return;
    setBusyId(d.id);
    try {
      await deleteDriverAdmin(d.id);
      if (selected?.id === d.id) setSelected(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">Livreurs</h1>
      <p className="text-sm text-gray-500 mb-6">
        Consultez la pièce d’identité et validez les candidatures.
      </p>

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
              className={`bg-white rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border ${
                d.status === 'pending'
                  ? 'border-amber-300 ring-1 ring-amber-100 bg-amber-50/30'
                  : 'border-gray-100'
              }`}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono font-bold text-[#FF6B00]">{d.driverCode}</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 uppercase">
                    {STATUS_LABEL[d.status] || d.status}
                  </span>
                </div>
                <p className="text-sm font-semibold mt-0.5">{d.ownerName}</p>
                <p className="text-xs text-gray-500">
                  {d.ownerPhone} · {d.city} ·{' '}
                  {VEHICLE_LABELS[d.vehicleType as VehicleType] || d.vehicleType}
                  {d.vehiclePlate ? ` (${d.vehiclePlate})` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openDetail(d)}
                  className="inline-flex items-center gap-1 px-3 py-2 border rounded-xl text-xs font-bold"
                >
                  <Eye size={14} /> Voir pièce
                </button>
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
                <button
                  type="button"
                  disabled={busyId === d.id}
                  onClick={() => onDelete(d)}
                  className="inline-flex items-center gap-1 px-3 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-bold"
                >
                  <Trash2 size={14} /> Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <AdminModal title={`Livreur — ${selected.driverCode}`} onClose={() => setSelected(null)} wide>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3 text-sm">
              <Row label="Nom" value={selected.ownerName} />
              <Row label="Téléphone" value={selected.ownerPhone} />
              <Row label="Email" value={selected.ownerEmail} />
              <Row label="Code" value={selected.driverCode} />
              <Row label="Statut" value={STATUS_LABEL[selected.status] || selected.status} />
              <Row label="Ville" value={`${selected.city} (${selected.country})`} />
              <Row
                label="Véhicule"
                value={`${VEHICLE_LABELS[selected.vehicleType as VehicleType] || selected.vehicleType}${
                  selected.vehiclePlate ? ` — ${selected.vehiclePlate}` : ''
                }`}
              />
              <Row label="Zones" value={selected.zones.join(', ') || '—'} />
              <Row label="Permis" value={selected.licenseNumber || '—'} />
              <Row
                label="Type de pièce"
                value={selected.idDocumentType?.toUpperCase() || '—'}
              />
              <Row label="Courses" value={String(selected.totalDeliveries)} />
              <Row
                label="Inscrit le"
                value={new Date(selected.createdAt).toLocaleString('fr-FR')}
              />
              {selected.rejectionReason && (
                <Row label="Motif refus" value={selected.rejectionReason} />
              )}
            </div>
            <div>
              <h3 className="font-extrabold mb-3">Pièce d’identité</h3>
              {docLoading ? (
                <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
              ) : (
                <DocPreview url={docUrl} />
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t">
            {selected.status === 'pending' && (
              <>
                <button
                  type="button"
                  onClick={() => onStatus(selected.id, 'approved')}
                  className="px-4 py-2.5 bg-[#00A651] text-white rounded-xl text-sm font-bold"
                >
                  Approuver
                </button>
                <button
                  type="button"
                  onClick={() => onStatus(selected.id, 'rejected')}
                  className="px-4 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-bold"
                >
                  Refuser
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => onDelete(selected)}
              className="px-4 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-bold ml-auto"
            >
              Supprimer
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase text-gray-400">{label}</p>
      <p className="font-semibold text-[#1F2937]">{value || '—'}</p>
    </div>
  );
}
