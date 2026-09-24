import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Info,
  Upload,
  Warehouse,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  AFRIZONE_WAREHOUSES,
  CATALOG_CATEGORIES,
  CATALOG_COUNTRIES,
  HANDOVER_METHOD_LABELS,
  warehousesForCountry,
} from '../../types/catalog';
import type {
  DeliveryMode,
  HandoverMethod,
  ProductCondition,
} from '../../types/catalog';
import {
  createProduct,
  fetchMyProduct,
  getVendorIdForUser,
  updateProduct,
  uploadProductImage,
} from '../../services/vendor';
import { fetchActiveSubscription } from '../../services/subscriptions';
import { PLATFORM_COMMISSION_RATE } from '../../lib/commission';

const STEPS = [
  { id: 1, label: 'Le produit', hint: 'Fiche catalogue + photo générique' },
  { id: 2, label: 'Réception AfriZone', hint: 'Photo réelle + remise au hub' },
] as const;

const MAX_IMAGES = 5;

export default function VendorProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'generic' | 'real' | null>(null);
  const [commissionRate, setCommissionRate] = useState(PLATFORM_COMMISSION_RATE);

  // ─── Étape 1 : fiche produit ───────────────────────────────────────
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(CATALOG_CATEGORIES[0]);
  const [subcategory, setSubcategory] = useState('');
  const [price, setPrice] = useState('');
  const [oldPrice, setOldPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [condition, setCondition] = useState<ProductCondition>('neuf');
  const [weightKg, setWeightKg] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('afrizone');
  const [deliveryZones, setDeliveryZones] = useState<string[]>([]);
  const [vendorDeliveryFee, setVendorDeliveryFee] = useState('');
  const [tags, setTags] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [images, setImages] = useState<string[]>([]);

  // ─── Étape 2 : réception entrepôt AfriZone ─────────────────────────
  const [realImages, setRealImages] = useState<string[]>([]);
  const [handoverMethod, setHandoverMethod] = useState<HandoverMethod>('drop_off');
  const [warehouseCity, setWarehouseCity] = useState('');
  const [expectedDropoffAt, setExpectedDropoffAt] = useState('');
  const [packageCount, setPackageCount] = useState('1');
  const [packageWeightKg, setPackageWeightKg] = useState('');
  const [packageLengthCm, setPackageLengthCm] = useState('');
  const [packageWidthCm, setPackageWidthCm] = useState('');
  const [packageHeightCm, setPackageHeightCm] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [receptionNotes, setReceptionNotes] = useState('');

  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  const vendorCountry = user?.vendor?.country;
  const warehouses = useMemo(
    () =>
      vendorCountry
        ? warehousesForCountry(vendorCountry)
        : Object.values(AFRIZONE_WAREHOUSES).flat(),
    [vendorCountry]
  );

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const vid = user.vendor?.id || (await getVendorIdForUser(user.id));
        if (!vid) {
          setError('Boutique non approuvée.');
          return;
        }
        setVendorId(vid);
        setContactName((prev) => prev || user.fullName || '');
        setContactPhone((prev) => prev || user.phone || '');

        try {
          const sub = await fetchActiveSubscription();
          if (sub?.audience === 'vendor' && sub.features.commissionPct != null) {
            setCommissionRate(Number(sub.features.commissionPct));
          }
        } catch {
          /* keep default */
        }

        if (id) {
          const product = await fetchMyProduct(vid, id);
          if (!product) {
            setError('Produit introuvable.');
            return;
          }
          setName(product.name);
          setDescription(product.description || '');
          setCategory(product.category);
          setSubcategory(product.subcategory || '');
          setPrice(String(product.price));
          setOldPrice(product.oldPrice != null ? String(product.oldPrice) : '');
          setStock(String(product.stock));
          setCondition((product.condition as ProductCondition) || 'neuf');
          setWeightKg(product.weightKg != null ? String(product.weightKg) : '');
          setDeliveryMode(product.deliveryMode);
          setDeliveryZones(product.deliveryZones || []);
          setVendorDeliveryFee(
            product.vendorDeliveryFee != null ? String(product.vendorDeliveryFee) : ''
          );
          setTags(product.tags.join(', '));
          setIsActive(product.isActive);
          setImages(product.images || []);
          setRealImages(product.realImages || []);
          setApprovalStatus(product.approvalStatus);
          setRejectionReason(product.rejectionReason);

          const r = product.reception;
          if (r.handoverMethod) setHandoverMethod(r.handoverMethod);
          setWarehouseCity(r.warehouseCity || '');
          setExpectedDropoffAt(r.expectedDropoffAt || '');
          setPackageCount(r.packageCount != null ? String(r.packageCount) : '1');
          setPackageWeightKg(r.packageWeightKg != null ? String(r.packageWeightKg) : '');
          setPackageLengthCm(r.packageLengthCm != null ? String(r.packageLengthCm) : '');
          setPackageWidthCm(r.packageWidthCm != null ? String(r.packageWidthCm) : '');
          setPackageHeightCm(r.packageHeightCm != null ? String(r.packageHeightCm) : '');
          if (r.contactName) setContactName(r.contactName);
          if (r.contactPhone) setContactPhone(r.contactPhone);
          setReceptionNotes(r.notes || '');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, id]);

  useEffect(() => {
    if (!warehouseCity && warehouses.length === 1) {
      setWarehouseCity(warehouses[0].city);
    }
  }, [warehouses, warehouseCity]);

  const toggleZone = (city: string) => {
    setDeliveryZones((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    );
  };

  const onUpload = async (files: FileList | null, kind: 'generic' | 'real') => {
    if (!files || !user) return;
    const current = kind === 'generic' ? images : realImages;
    if (current.length >= MAX_IMAGES) {
      setError(`Maximum ${MAX_IMAGES} photos.`);
      return;
    }
    setUploading(kind);
    setError(null);
    try {
      const selected = Array.from(files).slice(0, MAX_IMAGES - current.length);
      const urls: string[] = [];
      for (const file of selected) {
        urls.push(await uploadProductImage(user.id, file, kind));
      }
      const setter = kind === 'generic' ? setImages : setRealImages;
      setter((prev) => [...prev, ...urls]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'upload");
    } finally {
      setUploading(null);
    }
  };

  /** Contrôles de l'étape 1 avant de passer à la réception entrepôt. */
  const validateStep1 = (): string | null => {
    if (!name.trim() || name.trim().length < 3) return 'Titre trop court.';
    if (!description.trim() || description.trim().length < 10) {
      return 'Description trop courte.';
    }
    const p = Number(price);
    if (Number.isNaN(p) || p <= 0) return 'Prix invalide.';
    if (images.length < 1) return 'Ajoutez au moins 1 photo générique du produit.';
    if (deliveryMode === 'vendor') {
      if (!deliveryZones.length) return 'Indiquez au moins un pays de livraison.';
      if (!vendorDeliveryFee) return 'Indiquez vos frais de livraison.';
    }
    return null;
  };

  const validateStep2 = (): string | null => {
    if (realImages.length < 1) {
      return 'Ajoutez au moins 1 photo réelle du produit (prise par vous).';
    }
    if (handoverMethod !== 'vendor_stock' && !warehouseCity) {
      return 'Choisissez le hub AfriZone de réception.';
    }
    if (!contactPhone.trim()) return 'Téléphone de contact requis pour la réception.';
    return null;
  };

  const goToStep2 = () => {
    const problem = validateStep1();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) return;

    const problem = validateStep1() || validateStep2();
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const input = {
        name: name.trim(),
        description: description.trim(),
        category,
        subcategory: subcategory.trim() || undefined,
        price: Number(price),
        oldPrice: oldPrice ? Number(oldPrice) : null,
        stock: Number(stock),
        condition,
        weightKg: weightKg ? Number(weightKg) : null,
        deliveryMode,
        deliveryZones,
        vendorDeliveryFee: vendorDeliveryFee ? Number(vendorDeliveryFee) : null,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        isActive,
        images,
        mainImage: images[0],
        realImages,
        reception: {
          handoverMethod,
          warehouseCity: handoverMethod === 'vendor_stock' ? null : warehouseCity,
          expectedDropoffAt: expectedDropoffAt || null,
          packageCount: packageCount ? Number(packageCount) : null,
          packageWeightKg: packageWeightKg ? Number(packageWeightKg) : null,
          packageLengthCm: packageLengthCm ? Number(packageLengthCm) : null,
          packageWidthCm: packageWidthCm ? Number(packageWidthCm) : null,
          packageHeightCm: packageHeightCm ? Number(packageHeightCm) : null,
          contactName: contactName.trim() || null,
          contactPhone: contactPhone.trim() || null,
          notes: receptionNotes.trim() || null,
        },
      };

      if (isEdit && id) {
        await updateProduct(vendorId, id, input);
      } else {
        await createProduct(vendorId, input);
      }
      navigate('/vendeur/produits');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur enregistrement');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-40 bg-white rounded-2xl border animate-pulse" />;
  }

  const selectedWarehouse = warehouses.find((w) => w.city === warehouseCity);

  return (
    <div className="max-w-3xl">
      <Link
        to="/vendeur/produits"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#FF6B00] mb-4"
      >
        <ArrowLeft size={16} /> Retour aux produits
      </Link>
      <h1 className="text-2xl font-extrabold text-[#1F2937] mb-2">
        {isEdit ? 'Modifier le produit' : 'Nouveau produit'}
      </h1>
      <p className="text-sm text-gray-500 mb-5">
        Deux étapes : la fiche catalogue, puis la réception du produit dans l’entrepôt
        AfriZone. Un admin valide avant publication sur l’accueil et le catalogue.
      </p>

      {isEdit && approvalStatus === 'rejected' && rejectionReason && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm">
          <p className="font-extrabold text-red-700 mb-1">Produit refusé</p>
          <p className="text-red-700">{rejectionReason}</p>
          <p className="text-xs text-red-600 mt-2">
            Corrigez puis enregistrez : le produit repart en validation.
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {STEPS.map((s) => {
          const isCurrent = step === s.id;
          const isDone = step > s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (s.id === 1) {
                  setStep(1);
                  return;
                }
                goToStep2();
              }}
              className={`flex-1 text-left px-4 py-3 rounded-2xl border-2 transition-colors ${
                isCurrent
                  ? 'border-[#FF6B00] bg-orange-50'
                  : isDone
                    ? 'border-[#00A651]/40 bg-green-50/60'
                    : 'border-gray-200 bg-white'
              }`}
            >
              <span className="flex items-center gap-2 font-extrabold text-sm">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white ${
                    isDone ? 'bg-[#00A651]' : isCurrent ? 'bg-[#FF6B00]' : 'bg-gray-300'
                  }`}
                >
                  {isDone ? <Check size={13} /> : s.id}
                </span>
                Étape {s.id} — {s.label}
              </span>
              <span className="block text-xs text-gray-500 mt-1 pl-8">{s.hint}</span>
            </button>
          );
        })}
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5"
      >
        {step === 1 ? (
          <>
            <div>
              <label className="block text-sm font-bold mb-2">Titre *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none resize-none"
                required
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">Catégorie *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white"
                >
                  {CATALOG_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Sous-catégorie</label>
                <input
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">Prix client (FCFA) *</label>
                <input
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Ancien prix (barré)</label>
                <input
                  type="number"
                  min={0}
                  value={oldPrice}
                  onChange={(e) => setOldPrice(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Stock *</label>
                <input
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
                  required
                />
              </div>
            </div>

            {Number(price) > 0 && (
              <div className="rounded-2xl border border-[#00A651]/30 bg-green-50/70 p-4 text-sm leading-relaxed">
                <p className="font-extrabold text-[#008A43] mb-1">
                  Commission AfriZone {(commissionRate * 100).toFixed(0)} %
                </p>
                <p className="text-gray-700">
                  Prix affiché au client :{' '}
                  <strong>{Math.round(Number(price)).toLocaleString('fr-FR')} FCFA</strong>
                </p>
                <p className="text-gray-700">
                  Commission plateforme ({(commissionRate * 100).toFixed(0)} %) :{' '}
                  <strong>
                    {Math.round(Number(price) * commissionRate).toLocaleString('fr-FR')} FCFA
                  </strong>
                </p>
                <p className="text-gray-700">
                  Vous recevez (net) :{' '}
                  <strong className="text-[#00A651]">
                    {Math.round(Number(price) * (1 - commissionRate)).toLocaleString('fr-FR')}{' '}
                    FCFA
                  </strong>
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {commissionRate < PLATFORM_COMMISSION_RATE
                    ? 'Tarif Business actif (commission réduite).'
                    : 'Tenez compte de cette commission avant de fixer votre prix de vente.'}
                </p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">État *</label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as ProductCondition)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white"
                >
                  <option value="neuf">Neuf</option>
                  <option value="occasion">Occasion</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Poids (kg)</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">Mode de livraison *</label>
              <div className="grid sm:grid-cols-2 gap-3">
                <label
                  className={`p-4 border-2 rounded-xl cursor-pointer ${
                    deliveryMode === 'afrizone'
                      ? 'border-[#00A651] bg-green-50'
                      : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    className="mr-2 accent-[#00A651]"
                    checked={deliveryMode === 'afrizone'}
                    onChange={() => setDeliveryMode('afrizone')}
                  />
                  <span className="font-semibold text-sm">Livraison par AfriZone</span>
                </label>
                <label
                  className={`p-4 border-2 rounded-xl cursor-pointer ${
                    deliveryMode === 'vendor'
                      ? 'border-[#FF6B00] bg-orange-50'
                      : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    className="mr-2 accent-[#FF6B00]"
                    checked={deliveryMode === 'vendor'}
                    onChange={() => {
                      setDeliveryMode('vendor');
                      setHandoverMethod('vendor_stock');
                    }}
                  />
                  <span className="font-semibold text-sm">Je livre moi-même</span>
                </label>
              </div>
            </div>

            {deliveryMode === 'vendor' && (
              <div className="space-y-4 p-4 bg-orange-50 border border-orange-100 rounded-xl">
                <div>
                  <label className="block text-sm font-bold mb-2">Pays de livraison *</label>
                  <div className="flex flex-wrap gap-2">
                    {CATALOG_COUNTRIES.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => toggleZone(c.code)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 ${
                          deliveryZones.includes(c.code)
                            ? 'border-[#FF6B00] bg-white text-[#FF6B00]'
                            : 'border-gray-200 bg-white text-gray-500'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">
                    Frais livraison vendeur (FCFA) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={vendorDeliveryFee}
                    onChange={(e) => setVendorDeliveryFee(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold mb-1">
                Photos génériques du produit * (max {MAX_IMAGES})
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Visuels catalogue : photos officielles, packshots, rendus fabricant. La
                première photo sert de vignette.
              </p>
              <div className="flex flex-wrap gap-3 mb-3">
                {images.map((url) => (
                  <div
                    key={url}
                    className="relative w-24 h-24 rounded-xl overflow-hidden border"
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <label className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#FF6B00] text-sm font-semibold">
                <Upload size={16} />
                {uploading === 'generic' ? 'Upload...' : 'Ajouter des photos génériques'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={uploading !== null || images.length >= MAX_IMAGES}
                  onChange={(e) => onUpload(e.target.files, 'generic')}
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">Tags (virgules)</label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="smartphone, promo, apple"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="accent-[#00A651]"
              />
              <span className="text-sm font-semibold">
                Mettre en vente dès l’approbation admin
              </span>
            </label>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={goToStep2}
              disabled={uploading !== null}
              className="w-full py-3.5 bg-[#1F2937] hover:bg-black disabled:bg-gray-300 text-white rounded-xl font-bold inline-flex items-center justify-center gap-2"
            >
              Étape suivante — Réception AfriZone <ArrowRight size={16} />
            </button>
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-[#FF6B00]/30 bg-orange-50/70 p-4 text-sm leading-relaxed">
              <p className="font-extrabold text-[#1F2937] flex items-center gap-2 mb-1">
                <Warehouse size={16} className="text-[#FF6B00]" /> Réception du produit par
                AfriZone
              </p>
              <p className="text-gray-700">
                Cette étape indique à l’équipe logistique comment votre produit entre dans
                l’entrepôt AfriZone. Elle sert aussi de contrôle qualité : la photo réelle est
                comparée au colis reçu.
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">
                Photos réelles du produit * (max {MAX_IMAGES})
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Photos prises par vous, du produit réellement en stock (avec son emballage si
                possible). Elles ne sont pas publiées sur la fiche client : elles servent au
                contrôle à la réception.
              </p>
              <div className="flex flex-wrap gap-3 mb-3">
                {realImages.map((url) => (
                  <div
                    key={url}
                    className="relative w-24 h-24 rounded-xl overflow-hidden border"
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setRealImages((prev) => prev.filter((u) => u !== url))}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <label className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#00A651] text-sm font-semibold">
                <Camera size={16} />
                {uploading === 'real' ? 'Upload...' : 'Ajouter des photos réelles'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  className="hidden"
                  disabled={uploading !== null || realImages.length >= MAX_IMAGES}
                  onChange={(e) => onUpload(e.target.files, 'real')}
                />
              </label>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">Mode de remise *</label>
              <div className="space-y-2">
                {(Object.keys(HANDOVER_METHOD_LABELS) as HandoverMethod[]).map((method) => (
                  <label
                    key={method}
                    className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer ${
                      handoverMethod === method
                        ? 'border-[#00A651] bg-green-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <input
                      type="radio"
                      className="mt-0.5 accent-[#00A651]"
                      checked={handoverMethod === method}
                      onChange={() => setHandoverMethod(method)}
                    />
                    <span>
                      <span className="font-semibold text-sm block">
                        {HANDOVER_METHOD_LABELS[method]}
                      </span>
                      <span className="text-xs text-gray-500">
                        {method === 'drop_off' &&
                          'Vous apportez la marchandise au hub, un agent édite le bon de réception.'}
                        {method === 'pickup_request' &&
                          'Un livreur AfriZone passe à votre adresse récupérer le produit.'}
                        {method === 'vendor_stock' &&
                          'Le produit reste chez vous ; aucune entrée en entrepôt.'}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {handoverMethod !== 'vendor_stock' && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Hub AfriZone *</label>
                  <select
                    value={warehouseCity}
                    onChange={(e) => setWarehouseCity(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white"
                  >
                    <option value="">— Choisir —</option>
                    {warehouses.map((w) => (
                      <option key={w.city} value={w.city}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                  {selectedWarehouse && (
                    <p className="text-xs text-gray-500 mt-2">{selectedWarehouse.address}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">
                    {handoverMethod === 'drop_off' ? 'Date de dépôt prévue' : 'Date d’enlèvement souhaitée'}
                  </label>
                  <input
                    type="date"
                    value={expectedDropoffAt}
                    onChange={(e) => setExpectedDropoffAt(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
                  />
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">Nombre de colis</label>
                <input
                  type="number"
                  min={1}
                  value={packageCount}
                  onChange={(e) => setPackageCount(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Poids du colis (kg)</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={packageWeightKg}
                  onChange={(e) => setPackageWeightKg(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">
                Dimensions du colis (cm) — L × l × H
              </label>
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  placeholder="Longueur"
                  value={packageLengthCm}
                  onChange={(e) => setPackageLengthCm(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
                />
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  placeholder="Largeur"
                  value={packageWidthCm}
                  onChange={(e) => setPackageWidthCm(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
                />
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  placeholder="Hauteur"
                  value={packageHeightCm}
                  onChange={(e) => setPackageHeightCm(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">Contact réception</label>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Nom de la personne présente"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Téléphone contact *</label>
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+226 ..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">
                Consignes de manutention / stockage
              </label>
              <textarea
                value={receptionNotes}
                onChange={(e) => setReceptionNotes(e.target.value)}
                rows={3}
                placeholder="Ex. fragile, ne pas empiler, produit périssable à conserver au frais…"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl resize-none"
              />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm flex gap-3">
              <Info size={18} className="text-[#FF6B00] shrink-0 mt-0.5" />
              <p className="text-gray-700 leading-relaxed">
                À l’enregistrement, le produit passe en{' '}
                <strong>« En attente de validation »</strong>. Un admin vérifie la fiche, la
                photo générique et la photo réelle avant publication sur l’accueil et le
                catalogue.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="sm:w-auto px-5 py-3.5 border-2 border-gray-200 rounded-xl font-bold text-sm inline-flex items-center justify-center gap-2"
              >
                <ArrowLeft size={16} /> Étape précédente
              </button>
              <button
                type="submit"
                disabled={saving || uploading !== null}
                className="flex-1 py-3.5 bg-[#FF6B00] hover:bg-[#E05E00] disabled:bg-gray-300 text-white rounded-xl font-bold"
              >
                {saving
                  ? 'Enregistrement...'
                  : isEdit
                    ? 'Mettre à jour et renvoyer en validation'
                    : 'Envoyer pour validation'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
