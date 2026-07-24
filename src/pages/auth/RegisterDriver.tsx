import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bike, CheckCircle, Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CATALOG_CITIES } from '../../types/catalog';
import { VEHICLE_LABELS, type VehicleType } from '../../services/drivers';

const COUNTRIES = [
  { code: 'SN' as const, label: 'Sénégal' },
  { code: 'BF' as const, label: 'Burkina Faso' },
  { code: 'ML' as const, label: 'Mali' },
];

export default function RegisterDriverPage() {
  const { registerDriver } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [country, setCountry] = useState<'SN' | 'BF' | 'ML'>('SN');
  const [city, setCity] = useState('Dakar');
  const [vehicleType, setVehicleType] = useState<VehicleType>('moto');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [zones, setZones] = useState<string[]>(['Dakar']);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [idDocumentType, setIdDocumentType] = useState<'cni' | 'passport' | 'permis'>('cni');
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [doneCode, setDoneCode] = useState<string | null>(null);

  const toggleZone = (z: string) => {
    setZones((prev) => (prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z]));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await registerDriver({
      fullName,
      phone,
      email: email || undefined,
      password,
      confirmPassword,
      city,
      country,
      vehicleType,
      vehiclePlate,
      zones,
      licenseNumber,
      idDocument,
      idDocumentType,
      acceptTerms,
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Erreur');
      return;
    }
    setDoneCode(result.vendorCode || null);
  };

  if (doneCode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white border rounded-2xl p-8 max-w-md w-full text-center">
          <CheckCircle size={48} className="mx-auto text-[#00A651] mb-4" />
          <h1 className="text-2xl font-extrabold mb-2">Candidature envoyée</h1>
          <p className="text-sm text-gray-500 mb-4">
            Un admin doit valider votre compte livreur avant connexion.
          </p>
          <p className="font-mono font-bold text-[#FF6B00] text-lg mb-6">{doneCode}</p>
          <Link to="/auth/login" className="inline-block py-3 px-6 bg-[#FF6B00] text-white rounded-xl font-bold">
            Aller à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50 py-10 px-4">
      <div className="max-w-xl mx-auto bg-white border border-gray-100 rounded-2xl p-6 md:p-8">
        <div className="flex items-center gap-2 mb-6">
          <Bike className="text-[#FF6B00]" />
          <h1 className="text-2xl font-extrabold">Devenir livreur</h1>
        </div>
        <p className="text-xs mb-4 -mt-2">
          <Link to="/auth/register" className="text-[#FF6B00] font-semibold hover:underline">
            ← Changer de type de compte
          </Link>
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold mb-1">Nom complet *</label>
              <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Téléphone *</label>
              <input required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Email (optionnel)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold mb-1">Mot de passe *</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Confirmer *</label>
              <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold mb-1">Pays *</label>
              <select value={country} onChange={(e) => setCountry(e.target.value as 'SN' | 'BF' | 'ML')} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl bg-white">
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Ville *</label>
              <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl bg-white">
                {CATALOG_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold mb-1">Véhicule *</label>
              <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value as VehicleType)} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl bg-white">
                {(Object.keys(VEHICLE_LABELS) as VehicleType[]).map((v) => (
                  <option key={v} value={v}>{VEHICLE_LABELS[v]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Immatriculation</label>
              <input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">Zones desservies *</label>
            <div className="flex flex-wrap gap-2">
              {CATALOG_CITIES.map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => toggleZone(z)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 ${
                    zones.includes(z) ? 'border-[#FF6B00] bg-orange-50 text-[#FF6B00]' : 'border-gray-200'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">N° permis (optionnel)</label>
            <input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold mb-1">Type de pièce *</label>
              <select value={idDocumentType} onChange={(e) => setIdDocumentType(e.target.value as 'cni' | 'passport' | 'permis')} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl bg-white">
                <option value="cni">CNI</option>
                <option value="passport">Passeport</option>
                <option value="permis">Permis</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Document *</label>
              <button type="button" onClick={() => fileRef.current?.click()} className="w-full px-3 py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm flex items-center justify-center gap-2">
                <Upload size={16} /> {idDocument ? idDocument.name : 'Choisir un fichier'}
              </button>
              <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setIdDocument(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-1 accent-[#FF6B00]" />
            J&apos;accepte les conditions livreur AfriZone
          </label>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-[#FF6B00] text-white rounded-xl font-bold disabled:opacity-50">
            {loading ? 'Envoi...' : 'Envoyer ma candidature'}
          </button>
          <p className="text-center text-sm text-gray-500">
            Déjà inscrit ? <Link to="/auth/login" className="text-[#FF6B00] font-semibold">Connexion</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
