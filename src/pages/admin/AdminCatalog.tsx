import { useEffect, useState } from 'react';
import { Package, Pencil, Store, Trash2 } from 'lucide-react';
import AdminModal from '../../components/admin/AdminModal';
import { formatPrice } from '../../services/catalog';
import {
  deleteProductAdmin,
  deleteShopAdmin,
  fetchProductsForAdmin,
  fetchShopsForAdmin,
  updateProductAdmin,
  updateShopAdmin,
  type AdminProductRow,
  type AdminShopRow,
} from '../../services/admin-catalog';

export default function AdminCatalogPage() {
  const [tab, setTab] = useState<'shops' | 'products'>('shops');
  const [shops, setShops] = useState<AdminShopRow[]>([]);
  const [products, setProducts] = useState<AdminProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shopEdit, setShopEdit] = useState<AdminShopRow | null>(null);
  const [productEdit, setProductEdit] = useState<AdminProductRow | null>(null);
  const [shopForm, setShopForm] = useState({
    shopName: '',
    shopCategory: '',
    shopDescription: '',
    city: '',
    status: 'approved',
  });
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: 0,
    stock: 0,
    category: '',
    isActive: true,
    isFeatured: false,
  });
  const [busy, setBusy] = useState(false);
  const [filterShopId, setFilterShopId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        fetchShopsForAdmin(),
        fetchProductsForAdmin(filterShopId || undefined),
      ]);
      setShops(s);
      setProducts(p);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filterShopId]);

  const openShop = (s: AdminShopRow) => {
    setShopEdit(s);
    setShopForm({
      shopName: s.shopName,
      shopCategory: s.shopCategory || '',
      shopDescription: s.shopDescription || '',
      city: s.city,
      status: s.status,
    });
  };

  const openProduct = (p: AdminProductRow) => {
    setProductEdit(p);
    setProductForm({
      name: p.name,
      description: p.description || '',
      price: p.price,
      stock: p.stock,
      category: p.category,
      isActive: p.isActive,
      isFeatured: p.isFeatured,
    });
  };

  const saveShop = async () => {
    if (!shopEdit) return;
    setBusy(true);
    try {
      await updateShopAdmin(shopEdit.id, {
        shopName: shopForm.shopName,
        shopCategory: shopForm.shopCategory || null,
        shopDescription: shopForm.shopDescription || null,
        city: shopForm.city,
        status: shopForm.status,
      });
      setShopEdit(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const saveProduct = async () => {
    if (!productEdit) return;
    setBusy(true);
    try {
      await updateProductAdmin(productEdit.id, {
        name: productForm.name,
        description: productForm.description || null,
        price: Number(productForm.price),
        stock: Number(productForm.stock),
        category: productForm.category,
        isActive: productForm.isActive,
        isFeatured: productForm.isFeatured,
      });
      setProductEdit(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">Boutiques & produits</h1>
      <p className="text-sm text-gray-500 mb-6">Gérer le catalogue marketplace.</p>

      <div className="flex gap-2 mb-5">
        <button
          type="button"
          onClick={() => setTab('shops')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold ${
            tab === 'shops' ? 'bg-[#FF6B00] text-white' : 'bg-white border'
          }`}
        >
          <Store size={16} /> Boutiques ({shops.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('products')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold ${
            tab === 'products' ? 'bg-[#FF6B00] text-white' : 'bg-white border'
          }`}
        >
          <Package size={16} /> Produits ({products.length})
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-40 bg-white rounded-2xl border animate-pulse" />
      ) : tab === 'shops' ? (
        <div className="space-y-3">
          {shops.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                  {s.shopLogoUrl ? (
                    <img src={s.shopLogoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Store size={18} className="text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold truncate">{s.shopName}</p>
                  <p className="text-xs text-gray-500">
                    {s.vendorCode} · {s.city} · {s.productsCount ?? 0} produit(s) · {s.status}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFilterShopId(s.id);
                    setTab('products');
                  }}
                  className="px-3 py-2 border rounded-xl text-xs font-bold"
                >
                  Produits
                </button>
                <button
                  type="button"
                  onClick={() => openShop(s)}
                  className="p-2 border rounded-xl"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Supprimer la boutique ${s.shopName} ?`)) return;
                    try {
                      await deleteShopAdmin(s.id);
                      await load();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Erreur');
                    }
                  }}
                  className="p-2 border border-red-200 text-red-600 rounded-xl"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <div className="mb-4">
            <select
              value={filterShopId}
              onChange={(e) => setFilterShopId(e.target.value)}
              className="border-2 rounded-xl px-3 py-2 text-sm bg-white"
            >
              <option value="">Toutes les boutiques</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shopName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-3">
            {products.map((p) => (
              <div
                key={p.id}
                className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={
                      p.mainImage ||
                      p.images[0] ||
                      'https://images.unsplash.com/photo-1560393464-5c69a73c5770?w=80&h=80&fit=crop'
                    }
                    alt=""
                    className="w-14 h-14 rounded-xl object-cover"
                  />
                  <div className="min-w-0">
                    <p className="font-extrabold truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">
                      {p.vendorName} · {p.category} · stock {p.stock} ·{' '}
                      {p.isActive ? 'Actif' : 'Inactif'}
                    </p>
                    <p className="text-sm font-bold text-[#FF6B00]">{formatPrice(p.price)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openProduct(p)}
                    className="p-2 border rounded-xl"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`Supprimer « ${p.name} » ?`)) return;
                      try {
                        await deleteProductAdmin(p.id);
                        await load();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Erreur');
                      }
                    }}
                    className="p-2 border border-red-200 text-red-600 rounded-xl"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {!products.length && (
              <div className="bg-white border rounded-2xl p-8 text-center text-gray-500">
                Aucun produit.
              </div>
            )}
          </div>
        </div>
      )}

      {shopEdit && (
        <AdminModal title={`Boutique — ${shopEdit.shopName}`} onClose={() => setShopEdit(null)}>
          <div className="space-y-3">
            <input
              value={shopForm.shopName}
              onChange={(e) => setShopForm({ ...shopForm, shopName: e.target.value })}
              className="w-full border-2 rounded-xl px-3 py-2"
              placeholder="Nom"
            />
            <input
              value={shopForm.shopCategory}
              onChange={(e) => setShopForm({ ...shopForm, shopCategory: e.target.value })}
              className="w-full border-2 rounded-xl px-3 py-2"
              placeholder="Catégorie"
            />
            <input
              value={shopForm.city}
              onChange={(e) => setShopForm({ ...shopForm, city: e.target.value })}
              className="w-full border-2 rounded-xl px-3 py-2"
              placeholder="Ville"
            />
            <select
              value={shopForm.status}
              onChange={(e) => setShopForm({ ...shopForm, status: e.target.value })}
              className="w-full border-2 rounded-xl px-3 py-2"
            >
              <option value="pending">En attente</option>
              <option value="approved">Approuvé</option>
              <option value="rejected">Refusé</option>
              <option value="suspended">Suspendu</option>
            </select>
            <textarea
              value={shopForm.shopDescription}
              onChange={(e) => setShopForm({ ...shopForm, shopDescription: e.target.value })}
              rows={3}
              className="w-full border-2 rounded-xl px-3 py-2 resize-none"
              placeholder="Description"
            />
            <button
              type="button"
              disabled={busy}
              onClick={saveShop}
              className="w-full py-3 bg-[#FF6B00] text-white rounded-xl font-bold"
            >
              Enregistrer
            </button>
          </div>
        </AdminModal>
      )}

      {productEdit && (
        <AdminModal title={`Produit — ${productEdit.name}`} onClose={() => setProductEdit(null)}>
          <div className="space-y-3">
            <input
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              className="w-full border-2 rounded-xl px-3 py-2"
            />
            <input
              value={productForm.category}
              onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
              className="w-full border-2 rounded-xl px-3 py-2"
              placeholder="Catégorie"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={productForm.price}
                onChange={(e) =>
                  setProductForm({ ...productForm, price: Number(e.target.value) })
                }
                className="w-full border-2 rounded-xl px-3 py-2"
                placeholder="Prix"
              />
              <input
                type="number"
                value={productForm.stock}
                onChange={(e) =>
                  setProductForm({ ...productForm, stock: Number(e.target.value) })
                }
                className="w-full border-2 rounded-xl px-3 py-2"
                placeholder="Stock"
              />
            </div>
            <textarea
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              rows={3}
              className="w-full border-2 rounded-xl px-3 py-2 resize-none"
            />
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={productForm.isActive}
                onChange={(e) =>
                  setProductForm({ ...productForm, isActive: e.target.checked })
                }
              />
              Actif
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={productForm.isFeatured}
                onChange={(e) =>
                  setProductForm({ ...productForm, isFeatured: e.target.checked })
                }
              />
              Mis en avant
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={saveProduct}
              className="w-full py-3 bg-[#FF6B00] text-white rounded-xl font-bold"
            >
              Enregistrer
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
