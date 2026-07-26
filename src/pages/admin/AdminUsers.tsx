import { useEffect, useState } from 'react';
import { KeyRound, Pencil, Trash2 } from 'lucide-react';
import AdminModal from '../../components/admin/AdminModal';
import { useAuth } from '../../context/AuthContext';
import {
  deleteUserAdmin,
  fetchUsersForAdmin,
  ROLE_LABELS,
  setUserPasswordAdmin,
  updateUserAdmin,
  type AdminUserRow,
} from '../../services/admin-users';
import type { UserRole } from '../../types/auth';
import { CATALOG_CITIES } from '../../types/catalog';

const ROLE_FILTERS: Array<UserRole | 'all'> = ['all', 'client', 'vendeur', 'livreur', 'admin'];

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [filter, setFilter] = useState<UserRole | 'all'>('all');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [mode, setMode] = useState<'edit' | 'password'>('edit');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    city: '',
    role: 'client' as UserRole,
    verified: false,
  });
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setUsers(await fetchUsersForAdmin(filter));
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

  const openEdit = (u: AdminUserRow) => {
    setSelected(u);
    setMode('edit');
    setForm({
      fullName: u.fullName,
      email: u.email || '',
      phone: u.phone || '',
      city: u.city || 'Dakar',
      role: u.role,
      verified: u.verified,
    });
  };

  const openPassword = (u: AdminUserRow) => {
    setSelected(u);
    setMode('password');
    setPassword('');
    setPassword2('');
  };

  const onSave = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await updateUserAdmin(selected.id, {
        fullName: form.fullName,
        email: form.email || null,
        phone: form.phone || null,
        city: form.city || null,
        role: form.role,
        verified: form.verified,
      });
      setSelected(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const onPassword = async () => {
    if (!selected) return;
    if (password.length < 8) {
      setError('Mot de passe : minimum 8 caractères.');
      return;
    }
    if (password !== password2) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setBusy(true);
    try {
      await setUserPasswordAdmin(selected.id, password);
      setSelected(null);
      setError(null);
      alert('Mot de passe mis à jour.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur mot de passe (exécutez 011_admin_management.sql)');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (u: AdminUserRow) => {
    if (u.id === me?.id) {
      setError('Vous ne pouvez pas supprimer votre propre compte.');
      return;
    }
    if (!confirm(`Supprimer définitivement ${u.fullName} ?`)) return;
    setBusy(true);
    try {
      await deleteUserAdmin(u.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur suppression');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2">Utilisateurs</h1>
      <p className="text-sm text-gray-500 mb-6">
        Consulter, modifier, changer le mot de passe ou supprimer un compte.
      </p>

      <div className="flex gap-2 overflow-x-auto mb-5">
        {ROLE_FILTERS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setFilter(r)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
              filter === r ? 'bg-[#FF6B00] text-white' : 'bg-white border border-gray-200'
            }`}
          >
            {r === 'all' ? 'Tous' : ROLE_LABELS[r]}
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
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Utilisateur</th>
                  <th className="px-4 py-3">Rôle</th>
                  <th className="px-4 py-3">Ville</th>
                  <th className="px-4 py-3">Inscrit</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-bold">{u.fullName}</p>
                      <p className="text-xs text-gray-500">
                        {u.email || '—'} · {u.phone || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-50 text-[#FF6B00]">
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.city || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="p-2 border rounded-lg hover:bg-gray-50"
                          title="Modifier"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openPassword(u)}
                          className="p-2 border rounded-lg hover:bg-gray-50"
                          title="Mot de passe"
                        >
                          <KeyRound size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={u.id === me?.id || busy}
                          onClick={() => onDelete(u)}
                          className="p-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-40"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
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

      {selected && mode === 'edit' && (
        <AdminModal title={`Modifier — ${selected.fullName}`} onClose={() => setSelected(null)}>
          <div className="space-y-3">
            <Field label="Nom complet">
              <input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full border-2 rounded-xl px-3 py-2"
              />
            </Field>
            <Field label="Email">
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border-2 rounded-xl px-3 py-2"
              />
            </Field>
            <Field label="Téléphone">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border-2 rounded-xl px-3 py-2"
              />
            </Field>
            <Field label="Ville">
              <select
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full border-2 rounded-xl px-3 py-2"
              >
                {CATALOG_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Rôle">
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                className="w-full border-2 rounded-xl px-3 py-2"
              >
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={form.verified}
                onChange={(e) => setForm({ ...form, verified: e.target.checked })}
              />
              Compte vérifié
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={onSave}
              className="w-full py-3 bg-[#FF6B00] text-white rounded-xl font-bold disabled:opacity-50"
            >
              Enregistrer
            </button>
          </div>
        </AdminModal>
      )}

      {selected && mode === 'password' && (
        <AdminModal
          title={`Mot de passe — ${selected.fullName}`}
          onClose={() => setSelected(null)}
        >
          <div className="space-y-3">
            <Field label="Nouveau mot de passe">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border-2 rounded-xl px-3 py-2"
              />
            </Field>
            <Field label="Confirmer">
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="w-full border-2 rounded-xl px-3 py-2"
              />
            </Field>
            <button
              type="button"
              disabled={busy}
              onClick={onPassword}
              className="w-full py-3 bg-[#1F2937] text-white rounded-xl font-bold disabled:opacity-50"
            >
              Mettre à jour le mot de passe
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
