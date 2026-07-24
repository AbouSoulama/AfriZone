import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { updateMyProfile, uploadAvatar } from '../../services/account';
import { CATALOG_CITIES } from '../../types/catalog';

export default function AccountProfilePage() {
  const { user, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Dakar');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName || '');
    setPhone(user.phone || '');
    setEmail(user.email || '');
    setCity(user.city || 'Dakar');
  }, [user]);

  if (!user) return null;

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await updateMyProfile(user.id, { fullName, phone, city, email });
      await refreshProfile();
      setSuccess('Profil mis à jour.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const onAvatar = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      await uploadAvatar(user.id, file);
      await refreshProfile();
      setSuccess('Photo de profil mise à jour.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur upload');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6">
      <h2 className="font-extrabold text-lg mb-6">Mon profil</h2>

      <div className="flex items-center gap-4 mb-8">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-[#FF6B00] text-white flex items-center justify-center text-2xl font-bold overflow-hidden">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              user.fullName.charAt(0).toUpperCase()
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#1F2937] text-white flex items-center justify-center hover:bg-[#FF6B00] disabled:opacity-50"
            title="Changer la photo"
          >
            <Camera size={14} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onAvatar(e.target.files?.[0] ?? null)}
          />
        </div>
        <div>
          <p className="font-bold">{user.fullName}</p>
          <p className="text-xs text-gray-500 capitalize">{user.role}</p>
          {uploading && <p className="text-xs text-[#FF6B00] mt-1">Upload...</p>}
        </div>
      </div>

      <form onSubmit={onSave} className="space-y-4 max-w-lg">
        <div>
          <label className="block text-sm font-bold mb-2">Nom complet *</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">Téléphone *</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">Ville *</label>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white"
          >
            {CATALOG_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-[#FF6B00] hover:bg-[#E05E00] disabled:opacity-50 text-white rounded-xl font-bold"
        >
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </form>
    </div>
  );
}
