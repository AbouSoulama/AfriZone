import { useEffect, useState } from 'react';
import { MapPin, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  ADDRESS_COUNTRIES,
  createAddress,
  deleteAddress,
  fetchMyAddresses,
  setDefaultAddress,
  updateAddress,
  type AddressInput,
  type AddressView,
} from '../../services/account';
import { CATALOG_CITIES } from '../../types/catalog';

const emptyForm: AddressInput = {
  label: '',
  fullName: '',
  phone: '',
  country: 'SN',
  city: 'Dakar',
  address: '',
  isDefault: false,
};

export default function AccountAddressesPage() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<AddressView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressInput>(emptyForm);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      setAddresses(await fetchMyAddresses(user.id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      fullName: user?.fullName || '',
      phone: user?.phone || '',
      city: user?.city || 'Dakar',
      isDefault: addresses.length === 0,
    });
    setFormOpen(true);
  };

  const openEdit = (a: AddressView) => {
    setEditingId(a.id);
    setForm({
      label: a.label || '',
      fullName: a.fullName,
      phone: a.phone,
      country: a.country,
      city: a.city,
      address: a.address,
      isDefault: a.isDefault,
    });
    setFormOpen(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      if (editingId) {
        await updateAddress(user.id, editingId, form);
      } else {
        await createAddress(user.id, form);
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!user || !confirm('Supprimer cette adresse ?')) return;
    setBusy(true);
    try {
      await deleteAddress(user.id, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const onDefault = async (id: string) => {
    if (!user) return;
    setBusy(true);
    try {
      await setDefaultAddress(user.id, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-extrabold text-lg">Mes adresses</h2>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF6B00] text-white rounded-xl text-sm font-bold"
        >
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={onSubmit}
          className="bg-white border border-[#FF6B00] rounded-2xl p-5 space-y-3"
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-sm">
              {editingId ? 'Modifier l’adresse' : 'Nouvelle adresse'}
            </h3>
            <button type="button" onClick={() => setFormOpen(false)} className="text-gray-400">
              <X size={18} />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1">Libellé</label>
              <input
                value={form.label || ''}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Maison, Bureau..."
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-[#FF6B00] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Pays *</label>
              <select
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm bg-white"
              >
                {ADDRESS_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1">Nom *</label>
              <input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-[#FF6B00] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Téléphone *</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-[#FF6B00] focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">Adresse *</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              required
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-[#FF6B00] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1">Ville *</label>
            <select
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm bg-white"
            >
              {CATALOG_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="accent-[#FF6B00]"
            />
            Adresse par défaut
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 bg-[#00A651] text-white rounded-xl font-bold text-sm disabled:opacity-50"
          >
            {busy ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="h-32 bg-white rounded-2xl border animate-pulse" />
      ) : addresses.length === 0 ? (
        <div className="bg-white border rounded-2xl p-10 text-center text-gray-500">
          <MapPin size={32} className="mx-auto text-gray-300 mb-3" />
          Aucune adresse enregistrée.
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((a) => (
            <div
              key={a.id}
              className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-sm">{a.label || 'Adresse'}</p>
                  {a.isDefault && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-[#FF6B00]">
                      <Star size={10} /> Par défaut
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700">{a.fullName}</p>
                <p className="text-sm text-gray-500">
                  {a.address}, {a.city} ({a.country})
                </p>
                <p className="text-xs text-gray-400 mt-1">{a.phone}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!a.isDefault && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDefault(a.id)}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold hover:border-[#FF6B00]"
                  >
                    Définir par défaut
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openEdit(a)}
                  className="p-2 border border-gray-200 rounded-lg hover:border-[#FF6B00]"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDelete(a.id)}
                  className="p-2 border border-red-100 text-red-600 rounded-lg hover:bg-red-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
