import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatPrice } from '../../services/catalog';
import {
  deleteProduct,
  fetchMyProducts,
  getVendorIdForUser,
  setProductActive,
  updateStock,
} from '../../services/vendor';
import type { CatalogProduct } from '../../types/catalog';

export default function VendorProductsPage() {
  const { user } = useAuth();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (vid: string) => {
    setProducts(await fetchMyProducts(vid));
  };

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
        await load(vid);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const onToggle = async (p: CatalogProduct) => {
    if (!vendorId) return;
    await setProductActive(vendorId, p.id, !p.isActive);
    await load(vendorId);
  };

  const onDelete = async (p: CatalogProduct) => {
    if (!vendorId) return;
    if (!confirm(`Supprimer « ${p.name} » ?`)) return;
    await deleteProduct(vendorId, p.id);
    await load(vendorId);
  };

  const onStock = async (p: CatalogProduct, stock: number) => {
    if (!vendorId || Number.isNaN(stock) || stock < 0) return;
    await updateStock(vendorId, p.id, stock);
    await load(vendorId);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1F2937]">Mes produits</h1>
          <p className="text-sm text-gray-500">Gestion stock, activation et suppression</p>
        </div>
        <Link
          to="/vendeur/produits/nouveau"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF6B00] text-white rounded-xl text-sm font-bold"
        >
          <Plus size={16} /> Nouveau produit
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-40 bg-white rounded-2xl border animate-pulse" />
      ) : products.length === 0 ? (
        <div className="bg-white border rounded-2xl p-10 text-center">
          <p className="text-gray-600 mb-4">Aucun produit pour le moment.</p>
          <Link
            to="/vendeur/produits/nouveau"
            className="inline-flex px-4 py-2 bg-[#00A651] text-white rounded-xl text-sm font-bold"
          >
            Créer mon premier produit
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3">Prix</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Livraison</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            p.mainImage ||
                            p.images[0] ||
                            'https://images.unsplash.com/photo-1560393464-5c69a73c5770?w=80&h=80&fit=crop'
                          }
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div>
                          <p className="font-semibold text-[#1F2937]">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-[#FF6B00]">
                      {formatPrice(p.price)}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        defaultValue={p.stock}
                        key={`${p.id}-${p.stock}`}
                        onBlur={(e) => onStock(p, Number(e.target.value))}
                        className={`w-20 px-2 py-1 border-2 rounded-lg ${
                          p.stock <= 5 ? 'border-red-300' : 'border-gray-200'
                        }`}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {p.deliveryMode === 'afrizone' ? 'AfriZone' : 'Vendeur'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-full ${
                          p.isActive
                            ? 'bg-green-50 text-[#00A651]'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {p.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          to={`/vendeur/produits/${p.id}`}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                          title="Modifier"
                        >
                          <Pencil size={16} />
                        </Link>
                        <button
                          onClick={() => onToggle(p)}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                          title={p.isActive ? 'Désactiver' : 'Activer'}
                        >
                          {p.isActive ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button
                          onClick={() => onDelete(p)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
