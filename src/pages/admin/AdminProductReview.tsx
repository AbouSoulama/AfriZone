import { useEffect, useState } from 'react';
import { Camera, Check, Package, Warehouse, X } from 'lucide-react';
import AdminModal from '../../components/admin/AdminModal';
import { useAdminCountry } from '../../context/AdminCountryContext';
import { formatPrice } from '../../services/catalog';
import {
  fetchProductsToReview,
  reviewProductAdmin,
  type AdminProductRow,
} from '../../services/admin-catalog';
import {
  HANDOVER_METHOD_LABELS,
  PRODUCT_APPROVAL_LABELS,
  countryLabel,
} from '../../types/catalog';

type ReviewTab = 'pending' | 'rejected' | 'approved';

const TABS: { id: ReviewTab; label: string }[] = [
  { id: 'pending', label: 'À valider' },
  { id: 'rejected', label: 'Refusés' },
  { id: 'approved', label: 'Approuvés' },
];

function dateTime(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PhotoGrid({
  title,
  icon,
  urls,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  urls: string[];
  empty: string;
}) {
  return (
    <div>
      <p className="text-sm font-extrabold mb-2 flex items-center gap-2">
        {icon} {title} ({urls.length})
      </p>
      {urls.length === 0 ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          {empty}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {urls.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              <img
                src={url}
                alt=""
                className="w-24 h-24 rounded-xl object-cover border hover:ring-2 hover:ring-[#FF6B00]"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-right">{value || '—'}</span>
    </div>
  );
}

export default function AdminProductReviewPage() {
  const { adminCountry, adminCountryName } = useAdminCountry();
  const [tab, setTab] = useState<ReviewTab>('pending');
  const [products, setProducts] = useState<AdminProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminProductRow | null>(null);
  const [rejectFor, setRejectFor] = useState<AdminProductRow | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setProducts(await fetchProductsToReview(tab, adminCountry));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [tab, adminCountry]);

  const onApprove = async (product: AdminProductRow) => {
    setBusy(true);
    try {
      await reviewProductAdmin(product.id, true);
      setDetail(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const onReject = async () => {
    if (!rejectFor || !reason.trim()) return;
    setBusy(true);
    try {
      await reviewProductAdmin(rejectFor.id, false, reason);
      setRejectFor(null);
      setDetail(null);
      setReason('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">Validation des produits</h1>
      <p className="text-sm text-gray-500 mb-1">{adminCountryName}</p>
      <p className="text-sm text-gray-500 mb-6">
        Ouvrez la fiche pour comparer la photo générique et la photo réelle, vérifier les
        informations et les modalités de réception avant publication sur l’accueil et le
        catalogue.
      </p>

      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold ${
              tab === t.id ? 'bg-[#FF6B00] text-white' : 'bg-white border'
            }`}
          >
            {t.label}
            {tab === t.id ? ` (${products.length})` : ''}
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
      ) : products.length === 0 ? (
        <div className="bg-white border rounded-2xl p-10 text-center text-gray-500">
          Aucun produit dans cette liste.
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center gap-4"
            >
              <button
                type="button"
                onClick={() => setDetail(p)}
                className="flex items-center gap-3 min-w-0 flex-1 text-left"
              >
                <div className="flex gap-1 shrink-0">
                  <img
                    src={p.mainImage || p.images[0] || '/logo-afrizone.png'}
                    alt="Photo générique"
                    className="w-14 h-14 rounded-xl object-cover border"
                  />
                  {p.realImages[0] ? (
                    <img
                      src={p.realImages[0]}
                      alt="Photo réelle"
                      className="w-14 h-14 rounded-xl object-cover border-2 border-[#00A651]"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl border-2 border-dashed border-amber-300 flex items-center justify-center text-amber-500">
                      <Camera size={16} />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold truncate">{p.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {p.vendorName} · {p.category} · stock {p.stock} ·{' '}
                    {countryLabel(p.vendorCountry)}
                  </p>
                  <p className="text-sm font-bold text-[#FF6B00]">{formatPrice(p.price)}</p>
                  <p className="text-xs text-gray-400">
                    Soumis le {dateTime(p.approvalRequestedAt || p.createdAt)}
                  </p>
                </div>
              </button>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDetail(p)}
                  className="px-3 py-2 border rounded-xl text-xs font-bold"
                >
                  Voir la fiche
                </button>
                {p.approvalStatus !== 'approved' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onApprove(p)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#00A651] text-white rounded-xl text-xs font-bold disabled:opacity-50"
                  >
                    <Check size={14} /> Approuver
                  </button>
                )}
                {p.approvalStatus !== 'rejected' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setRejectFor(p);
                      setReason('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-bold disabled:opacity-50"
                  >
                    <X size={14} /> Refuser
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <AdminModal wide title={detail.name} onClose={() => setDetail(null)}>
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded-full bg-gray-100 font-bold">
                {PRODUCT_APPROVAL_LABELS[detail.approvalStatus]}
              </span>
              <span className="px-2 py-1 rounded-full bg-gray-100 font-bold">
                {detail.isActive ? 'Mise en vente demandée' : 'Inactif'}
              </span>
              <span className="px-2 py-1 rounded-full bg-gray-100 font-bold">
                {detail.deliveryMode === 'afrizone'
                  ? 'Livraison AfriZone'
                  : 'Livraison vendeur'}
              </span>
            </div>

            {detail.approvalStatus === 'rejected' && detail.rejectionReason && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <strong>Motif du refus :</strong> {detail.rejectionReason}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-5">
              <PhotoGrid
                title="Photos génériques (catalogue)"
                icon={<Package size={15} className="text-[#FF6B00]" />}
                urls={detail.images}
                empty="Aucune photo générique — à refuser."
              />
              <PhotoGrid
                title="Photos réelles (réception)"
                icon={<Camera size={15} className="text-[#00A651]" />}
                urls={detail.realImages}
                empty="Aucune photo réelle — le vendeur doit compléter l’étape 2."
              />
            </div>

            <div>
              <p className="text-sm font-extrabold mb-2">Fiche produit</p>
              <div className="rounded-xl border border-gray-100 px-4 py-2">
                <Row label="Boutique" value={`${detail.vendorName} (${detail.vendorCode})`} />
                <Row
                  label="Localisation vendeur"
                  value={`${detail.vendorCity || '—'} · ${countryLabel(detail.vendorCountry)}`}
                />
                <Row
                  label="Catégorie"
                  value={[detail.category, detail.subcategory].filter(Boolean).join(' › ')}
                />
                <Row label="Prix client" value={formatPrice(detail.price)} />
                <Row
                  label="Ancien prix"
                  value={detail.oldPrice ? formatPrice(detail.oldPrice) : '—'}
                />
                <Row label="Stock" value={detail.stock} />
                <Row label="État" value={detail.condition} />
                <Row
                  label="Poids unitaire"
                  value={detail.weightKg != null ? `${detail.weightKg} kg` : '—'}
                />
                {detail.deliveryMode === 'vendor' && (
                  <>
                    <Row
                      label="Zones vendeur"
                      value={(detail.deliveryZones || []).map(countryLabel).join(', ')}
                    />
                    <Row
                      label="Frais vendeur"
                      value={
                        detail.vendorDeliveryFee != null
                          ? formatPrice(detail.vendorDeliveryFee)
                          : '—'
                      }
                    />
                  </>
                )}
                <Row label="Tags" value={detail.tags.join(', ')} />
                <Row label="Soumis le" value={dateTime(detail.approvalRequestedAt)} />
              </div>
            </div>

            {detail.description && (
              <div>
                <p className="text-sm font-extrabold mb-2">Description</p>
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                  {detail.description}
                </p>
              </div>
            )}

            <div>
              <p className="text-sm font-extrabold mb-2 flex items-center gap-2">
                <Warehouse size={15} className="text-[#FF6B00]" /> Réception entrepôt
                (étape 2)
              </p>
              <div className="rounded-xl border border-gray-100 px-4 py-2">
                <Row
                  label="Mode de remise"
                  value={
                    detail.reception.handoverMethod
                      ? HANDOVER_METHOD_LABELS[detail.reception.handoverMethod]
                      : '—'
                  }
                />
                <Row label="Hub AfriZone" value={detail.reception.warehouseCity} />
                <Row
                  label="Date prévue"
                  value={
                    detail.reception.expectedDropoffAt
                      ? new Date(detail.reception.expectedDropoffAt).toLocaleDateString('fr-FR')
                      : '—'
                  }
                />
                <Row label="Nombre de colis" value={detail.reception.packageCount} />
                <Row
                  label="Poids colis"
                  value={
                    detail.reception.packageWeightKg != null
                      ? `${detail.reception.packageWeightKg} kg`
                      : '—'
                  }
                />
                <Row
                  label="Dimensions"
                  value={
                    detail.reception.packageLengthCm != null
                      ? `${detail.reception.packageLengthCm} × ${detail.reception.packageWidthCm ?? '?'} × ${detail.reception.packageHeightCm ?? '?'} cm`
                      : '—'
                  }
                />
                <Row
                  label="Contact"
                  value={[detail.reception.contactName, detail.reception.contactPhone]
                    .filter(Boolean)
                    .join(' · ')}
                />
                <Row label="Consignes" value={detail.reception.notes} />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                disabled={busy || detail.approvalStatus === 'approved'}
                onClick={() => void onApprove(detail)}
                className="flex-1 py-3 bg-[#00A651] text-white rounded-xl font-bold disabled:bg-gray-300"
              >
                Approuver et publier
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setRejectFor(detail);
                  setReason('');
                }}
                className="flex-1 py-3 border-2 border-red-200 text-red-600 rounded-xl font-bold"
              >
                Refuser
              </button>
            </div>
          </div>
        </AdminModal>
      )}

      {rejectFor && (
        <AdminModal
          title={`Refuser — ${rejectFor.name}`}
          onClose={() => setRejectFor(null)}
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Le motif est envoyé au vendeur en notification. Il pourra corriger puis
              resoumettre le produit.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Ex. la photo réelle ne correspond pas à la photo générique."
              className="w-full border-2 rounded-xl px-3 py-2 resize-none"
            />
            <button
              type="button"
              disabled={busy || !reason.trim()}
              onClick={() => void onReject()}
              className="w-full py-3 bg-red-600 text-white rounded-xl font-bold disabled:bg-gray-300"
            >
              Confirmer le refus
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
