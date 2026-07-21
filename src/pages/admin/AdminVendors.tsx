import { useEffect, useState } from 'react';
import { CheckCircle, Eye, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchVendorsForAdmin,
  getVendorDocumentUrl,
  updateVendorStatus,
  type AdminVendorRow,
} from '../../services/admin';
import type { VendorStatus } from '../../types/auth';

export default function AdminVendorsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<VendorStatus | 'all'>('pending');
  const [vendors, setVendors] = useState<AdminVendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setVendors(await fetchVendorsForAdmin(filter));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  const onStatus = async (vendor: AdminVendorRow, status: VendorStatus) => {
    if (!user) return;
    let reason: string | undefined;
    if (status === 'rejected') {
      reason = prompt('Motif du refus (optionnel) :') || undefined;
    }
    setBusyId(vendor.id);
    try {
      await updateVendorStatus(vendor.id, status, user.id, reason);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur mise à jour');
    } finally {
      setBusyId(null);
    }
  };

  const viewDoc = async (vendor: AdminVendorRow) => {
    if (!vendor.idDocumentUrl) {
      setError('Aucun document uploadé.');
      return;
    }
    const url = await getVendorDocumentUrl(vendor.idDocumentUrl);
    if (!url) {
      setError('Impossible d’ouvrir le document (vérifiez le bucket vendor-documents).');
      return;
    }
    setDocUrl(url);
    window.open(url, '_blank');
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1F2937]">Gestion des vendeurs</h1>
          <p className="text-sm text-gray-500">Valider, suspendre ou refuser les dossiers</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as VendorStatus | 'all')}
          className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
        >
          <option value="pending">En attente</option>
          <option value="approved">Approuvés</option>
          <option value="rejected">Refusés</option>
          <option value="suspended">Suspendus</option>
          <option value="all">Tous</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-40 bg-white rounded-2xl border animate-pulse" />
      ) : vendors.length === 0 ? (
        <div className="bg-white border rounded-2xl p-10 text-center text-gray-500">
          Aucun vendeur pour ce filtre.
        </div>
      ) : (
        <div className="space-y-4">
          {vendors.map((v) => (
            <div key={v.id} className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h2 className="font-extrabold text-lg text-[#1F2937]">{v.shopName}</h2>
                    <span className="text-xs font-mono text-[#FF6B00]">{v.vendorCode}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        v.status === 'pending'
                          ? 'bg-amber-50 text-amber-700'
                          : v.status === 'approved'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {v.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {v.ownerName} · {v.ownerPhone} · {v.ownerEmail}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {v.city}, {v.country} — {v.shopCategory}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Inscrit le {new Date(v.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                  {v.shopDescription && (
                    <p className="text-sm text-gray-600 mt-2 max-w-2xl">{v.shopDescription}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => viewDoc(v)}
                    className="inline-flex items-center gap-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-xs font-bold"
                  >
                    <Eye size={14} /> CNI / Passeport
                  </button>
                  {v.status !== 'approved' && (
                    <button
                      disabled={busyId === v.id}
                      onClick={() => onStatus(v, 'approved')}
                      className="inline-flex items-center gap-1 px-3 py-2 bg-[#00A651] text-white rounded-xl text-xs font-bold disabled:opacity-50"
                    >
                      <CheckCircle size={14} /> Approuver
                    </button>
                  )}
                  {v.status !== 'rejected' && (
                    <button
                      disabled={busyId === v.id}
                      onClick={() => onStatus(v, 'rejected')}
                      className="inline-flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                    >
                      <XCircle size={14} /> Refuser
                    </button>
                  )}
                  {v.status === 'approved' && (
                    <button
                      disabled={busyId === v.id}
                      onClick={() => onStatus(v, 'suspended')}
                      className="inline-flex items-center gap-1 px-3 py-2 border-2 border-amber-300 text-amber-700 rounded-xl text-xs font-bold"
                    >
                      Suspendre
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {docUrl && (
        <p className="text-xs text-gray-400 mt-4">
          Document ouvert dans un nouvel onglet (lien signé, expire bientôt).
        </p>
      )}
    </div>
  );
}
