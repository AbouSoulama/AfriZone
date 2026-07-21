import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Upload, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CATALOG_CATEGORIES, CATALOG_CITIES } from '../../types/catalog';
import type { DeliveryMode, ProductCondition } from '../../types/catalog';
import {
  createProduct,
  fetchMyProduct,
  getVendorIdForUser,
  updateProduct,
  uploadProductImage,
} from '../../services/vendor';

export default function VendorProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, id]);

  const toggleZone = (city: string) => {
    setDeliveryZones((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    );
  };

  const onUpload = async (files: FileList | null) => {
    if (!files || !user) return;
    if (images.length >= 5) {
      setError('Maximum 5 images.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const remaining = 5 - images.length;
      const selected = Array.from(files).slice(0, remaining);
      const urls: string[] = [];
      for (const file of selected) {
        urls.push(await uploadProductImage(user.id, file));
      }
      setImages((prev) => [...prev, ...urls]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) return;
    setSaving(true);
    setError(null);

    try {
      if (images.length < 1) {
        throw new Error('Ajoutez au moins 1 image produit.');
      }

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
      };

      if (!input.name || input.name.length < 3) throw new Error('Titre trop court.');
      if (!input.description || input.description.length < 10) {
        throw new Error('Description trop courte.');
      }
      if (Number.isNaN(input.price) || input.price <= 0) throw new Error('Prix invalide.');

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

  return (
    <div className="max-w-3xl">
      <Link
        to="/vendeur/produits"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#FF6B00] mb-4"
      >
        <ArrowLeft size={16} /> Retour aux produits
      </Link>
      <h1 className="text-2xl font-extrabold text-[#1F2937] mb-6">
        {isEdit ? 'Modifier le produit' : 'Nouveau produit'}
      </h1>

      <form onSubmit={onSubmit} className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5">
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
            <label className="block text-sm font-bold mb-2">Prix (FCFA) *</label>
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
            <label className="block text-sm font-bold mb-2">Prix barré</label>
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
                deliveryMode === 'afrizone' ? 'border-[#00A651] bg-green-50' : 'border-gray-200'
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
                deliveryMode === 'vendor' ? 'border-[#FF6B00] bg-orange-50' : 'border-gray-200'
              }`}
            >
              <input
                type="radio"
                className="mr-2 accent-[#FF6B00]"
                checked={deliveryMode === 'vendor'}
                onChange={() => setDeliveryMode('vendor')}
              />
              <span className="font-semibold text-sm">Je livre moi-même</span>
            </label>
          </div>
        </div>

        {deliveryMode === 'vendor' && (
          <div className="space-y-4 p-4 bg-orange-50 border border-orange-100 rounded-xl">
            <div>
              <label className="block text-sm font-bold mb-2">Zones de livraison *</label>
              <div className="flex flex-wrap gap-2">
                {CATALOG_CITIES.map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => toggleZone(city)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 ${
                      deliveryZones.includes(city)
                        ? 'border-[#FF6B00] bg-white text-[#FF6B00]'
                        : 'border-gray-200 bg-white text-gray-500'
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Frais livraison vendeur (FCFA) *</label>
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
          <label className="block text-sm font-bold mb-2">Images * (max 5)</label>
          <div className="flex flex-wrap gap-3 mb-3">
            {images.map((url) => (
              <div key={url} className="relative w-24 h-24 rounded-xl overflow-hidden border">
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
            {uploading ? 'Upload...' : 'Ajouter des images'}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploading || images.length >= 5}
              onChange={(e) => onUpload(e.target.files)}
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
          <span className="text-sm font-semibold">Produit actif (visible catalogue)</span>
        </label>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving || uploading}
          className="w-full py-3.5 bg-[#FF6B00] hover:bg-[#E05E00] disabled:bg-gray-300 text-white rounded-xl font-bold"
        >
          {saving ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer le produit'}
        </button>
      </form>
    </div>
  );
}
