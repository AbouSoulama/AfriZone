import { useEffect, useState } from 'react';
import { CheckCircle, Eye, Trash2, XCircle } from 'lucide-react';
import AdminModal from '../../components/admin/AdminModal';
import { DocPreview } from '../../components/admin/DocPreview';
import { useAuth } from '../../context/AuthContext';
import {
  deleteVendorAdmin,
  fetchVendorsForAdmin,
  getVendorDocumentUrl,
  updateVendorAdmin,
  updateVendorStatus,
  type AdminVendorRow,
} from '../../services/admin';
import type { VendorStatus } from '../../types/auth';

const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente',
  approved: 'Approuvé',
  rejected: 'Refusé',
  suspended: 'Suspendu',
};

export default function AdminVendorsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<VendorStatus | 'all'>('all');
  const [vendors, setVendors] = useState<AdminVendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminVendorRow | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [edit, setEdit] = useState({
    shopName: '',
    shopCategory: '',
    shopDescription: '',
    city: '',
    country: '',
    address: '',
  });

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

  const openDetail = async (v: AdminVendorRow) => {
    setSelected(v);
    setEdit({
      shopName: v.shopName,
      shopCategory: v.shopCategory || '',
      shopDescription: v.shopDescription || '',
      city: v.city,
      country: v.country,
      address: v.address || '',
    });
    setDocUrl(null);
    if (v.idDocumentUrl) {
      setDocLoading(true);
      const url = await getVendorDocumentUrl(v.idDocumentUrl);
      setDocUrl(url);
      setDocLoading(false);
      if (!url) setError('Impossible de charger la pièce (exécutez 011_admin_management.sql).');
    }
  };

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
      if (selected?.id === vendor.id) {
        const refreshed = (await fetchVendorsForAdmin('all')).find((x) => x.id === vendor.id);
        if (refreshed) setSelected(refreshed);
        else setSelected(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur mise à jour');
    } finally {
      setBusyId(null);
    }
  };

  const onSave = async () => {
    if (!selected) return;
    setBusyId(selected.id);
    try {
      await updateVendorAdmin(selected.id, {
        shopName: edit.shopName,
        shopCategory: edit.shopCategory || null,
        shopDescription: edit.shopDescription || null,
        city: edit.city,
        country: edit.country,
        address: edit.address || null,
      });
      await load();
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (vendor: AdminVendorRow) => {
    if (
      !confirm(
        `Supprimer la boutique « ${vendor.shopName} » et tous ses produits ? Cette action est irréversible.`
      )
    ) {
      return;
    }
    setBusyId(vendor.id);
    try {
      await deleteVendorAdmin(vendor.id);
      if (selected?.id === vendor.id) setSelected(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur suppression');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1F2937]">Gestion des vendeurs</h1>
          <p className="text-sm text-gray-500">Consulter le dossier, la pièce d’identité, valider ou supprimer</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as VendorStatus | 'all')}
          className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
        >
          <option value="all">Tous</option>
          <option value="pending">En attente</option>
          <option value="approved">Approuvés</option>
          <option value="rejected">Refusés</option>
          <option value="suspended">Suspendus</option>
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
            <div
              key={v.id}
              className={`bg-white rounded-2xl p-5 border ${
                v.status === 'pending'
                  ? 'border-amber-300 ring-1 ring-amber-100 bg-amber-50/30'
                  : 'border-gray-100'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="min-w-0">
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
                      {STATUS_LABEL[v.status] || v.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {v.ownerName} · {v.ownerPhone} · {v.ownerEmail}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {v.city}, {v.country} — {v.shopCategory || 'Sans catégorie'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openDetail(v)}
                    className="inline-flex items-center gap-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-xs font-bold"
                  >
                    <Eye size={14} /> Voir dossier
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
                  <button
                    disabled={busyId === v.id}
                    onClick={() => onDelete(v)}
                    className="inline-flex items-center gap-1 px-3 py-2 border-2 border-red-200 text-red-600 rounded-xl text-xs font-bold disabled:opacity-50"
                  >
                    <Trash2 size={14} /> Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <AdminModal title={`Dossier — ${selected.shopName}`} onClose={() => setSelected(null)} wide>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3 text-sm">
              <h3 className="font-extrabold text-[#1F2937]">Informations</h3>
              <Info label="Titulaire" value={selected.ownerName} />
              <Info label="Téléphone" value={selected.ownerPhone} />
              <Info label="Email" value={selected.ownerEmail} />
              <Info label="Code vendeur" value={selected.vendorCode} />
              <Info label="Statut" value={STATUS_LABEL[selected.status] || selected.status} />
              <Info
                label="Pièce"
                value={
                  selected.idDocumentType
                    ? selected.idDocumentType.toUpperCase()
                    : 'Non renseigné'
                }
              />
              <Info label="RCCM" value={selected.commerceRegister || '—'} />
              <Info
                label="Inscrit le"
                value={new Date(selected.createdAt).toLocaleString('fr-FR')}
              />
              {selected.rejectionReason && (
                <Info label="Motif refus" value={selected.rejectionReason} />
              )}

              <div className="pt-2 space-y-2">
                <label className="block text-xs font-bold text-gray-500">Nom boutique</label>
                <input
                  value={edit.shopName}
                  onChange={(e) => setEdit({ ...edit, shopName: e.target.value })}
                  className="w-full border-2 rounded-xl px-3 py-2"
                />
                <label className="block text-xs font-bold text-gray-500">Catégorie</label>
                <input
                  value={edit.shopCategory}
                  onChange={(e) => setEdit({ ...edit, shopCategory: e.target.value })}
                  className="w-full border-2 rounded-xl px-3 py-2"
                />
                <label className="block text-xs font-bold text-gray-500">Ville / Pays</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={edit.city}
                    onChange={(e) => setEdit({ ...edit, city: e.target.value })}
                    className="w-full border-2 rounded-xl px-3 py-2"
                  />
                  <input
                    value={edit.country}
                    onChange={(e) => setEdit({ ...edit, country: e.target.value })}
                    className="w-full border-2 rounded-xl px-3 py-2"
                  />
                </div>
                <label className="block text-xs font-bold text-gray-500">Adresse</label>
                <input
                  value={edit.address}
                  onChange={(e) => setEdit({ ...edit, address: e.target.value })}
                  className="w-full border-2 rounded-xl px-3 py-2"
                />
                <label className="block text-xs font-bold text-gray-500">Description</label>
                <textarea
                  value={edit.shopDescription}
                  onChange={(e) => setEdit({ ...edit, shopDescription: e.target.value })}
                  rows={3}
                  className="w-full border-2 rounded-xl px-3 py-2 resize-none"
                />
              </div>
            </div>

            <div>
              <h3 className="font-extrabold text-[#1F2937] mb-3">CNI / Passeport</h3>
              {docLoading ? (
                <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
              ) : (
                <DocPreview url={docUrl} />
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t">
            <button
              type="button"
              disabled={busyId === selected.id}
              onClick={onSave}
              className="px-4 py-2.5 bg-[#1F2937] text-white rounded-xl text-sm font-bold disabled:opacity-50"
            >
              Enregistrer
            </button>
            {selected.status !== 'approved' && (
              <button
                type="button"
                disabled={busyId === selected.id}
                onClick={() => onStatus(selected, 'approved')}
                className="px-4 py-2.5 bg-[#00A651] text-white rounded-xl text-sm font-bold"
              >
                Approuver
              </button>
            )}
            {selected.status === 'approved' && (
              <button
                type="button"
                disabled={busyId === selected.id}
                onClick={() => onStatus(selected, 'suspended')}
                className="px-4 py-2.5 border-2 border-amber-300 text-amber-700 rounded-xl text-sm font-bold"
              >
                Suspendre
              </button>
            )}
            <button
              type="button"
              disabled={busyId === selected.id}
              onClick={() => onDelete(selected)}
              className="px-4 py-2.5 border-2 border-red-200 text-red-600 rounded-xl text-sm font-bold ml-auto"
            >
              Supprimer
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase text-gray-400">{label}</p>
      <p className="font-semibold text-[#1F2937]">{value || '—'}</p>
    </div>
  );
}
