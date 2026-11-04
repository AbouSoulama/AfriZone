import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bike, CheckCircle, Upload, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCountry } from '../../context/CountryContext';
import { IdDocumentScanner } from '../../components/IdDocumentScanner';
import { validateIdDocument } from '../../lib/auth-helpers';
import type { IdScanResult } from '../../lib/id-document-scan';
import { CITIES_BY_COUNTRY, capitalForCountry } from '../../types/catalog';
import { VEHICLE_LABELS, type VehicleType } from '../../services/drivers';

export default function RegisterDriverPage() {
  const { registerDriver } = useAuth();
  const { country, countryName } = useCountry();
  const cities = CITIES_BY_COUNTRY[country];
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [city, setCity] = useState(() => capitalForCountry(country));
  const [vehicleType, setVehicleType] = useState<VehicleType>('moto');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [zones, setZones] = useState<string[]>(() => [capitalForCountry(country)]);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [idDocumentType, setIdDocumentType] = useState<'cni' | 'passport'>('cni');
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [idDocPreview, setIdDocPreview] = useState<string | null>(null);
  const [idScanOk, setIdScanOk] = useState(false);
  const [idScanPending, setIdScanPending] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [doneCode, setDoneCode] = useState<string | null>(null);

  useEffect(() => {
    const capital = capitalForCountry(country);
    setCity(capital);
    setZones([capital]);
  }, [country]);

  // Re-lance le scan si l’utilisateur change CNI ↔ Passeport avec un fichier déjà choisi
  useEffect(() => {
    if (!idDocument) return;
    setIdScanOk(false);
    setIdScanPending(true);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rescan on type only
  }, [idDocumentType]);

  const toggleZone = (z: string) => {
    setZones((prev) => (prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z]));
  };

  const handleIdFileChange = (file: File | null) => {
    if (idDocPreview) URL.revokeObjectURL(idDocPreview);

    if (!file) {
      setIdDocument(null);
      setIdDocPreview(null);
      setIdScanOk(false);
      setIdScanPending(false);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    const validationError = validateIdDocument(file);
    if (validationError) {
      setError(validationError);
      setIdDocument(null);
      setIdDocPreview(null);
      setIdScanOk(false);
      setIdScanPending(false);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    setError(null);
    setIdScanOk(false);
    setIdScanPending(true);
    setIdDocument(file);
    if (file.type.startsWith('image/')) {
      setIdDocPreview(URL.createObjectURL(file));
    } else {
      setIdDocPreview(null);
    }
  };

  const handleIdScanComplete = useCallback((result: IdScanResult) => {
    setIdScanPending(false);
    // valid et uncertain permettent de continuer (revue admin si uncertain)
    setIdScanOk(result.ok);
    if (!result.ok) {
      setError(result.error || result.message || 'Le document n’a pas passé le scanner d’authenticité.');
    } else {
      setError(null);
    }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (zones.length === 0) {
      setError('Sélectionnez au moins une zone desservie');
      setLoading(false);
      return;
    }
    const docError = validateIdDocument(idDocument);
    if (docError) {
      setError(docError);
      setLoading(false);
      return;
    }
    if (idScanPending) {
      setError('Patientez : le scanner d’authenticité analyse encore votre pièce.');
      setLoading(false);
      return;
    }
    if (!idScanOk) {
      setError('La pièce doit être une CNI ou un passeport accepté par le scanner.');
      setLoading(false);
      return;
    }
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
            Compte client
          </Link>
          {' · '}
          Inscription livreur · {countryName}
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1">Nom complet *</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold mb-1">Téléphone *</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold mb-1">Mot de passe *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Confirmation *</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Ville *</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl bg-white"
            >
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold mb-1">Véhicule *</label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl bg-white"
              >
                {(Object.keys(VEHICLE_LABELS) as VehicleType[]).map((k) => (
                  <option key={k} value={k}>
                    {VEHICLE_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Immatriculation</label>
              <input
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">Zones desservies (villes) *</label>
            <div className="flex flex-wrap gap-2">
              {cities.map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => toggleZone(z)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 ${
                    zones.includes(z)
                      ? 'border-[#FF6B00] bg-orange-50 text-[#FF6B00]'
                      : 'border-gray-200'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">N° permis (optionnel)</label>
            <input
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Type de pièce d&apos;identité *</label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-2 p-3 border-2 rounded-xl cursor-pointer ${
                  idDocumentType === 'cni' ? 'border-[#FF6B00] bg-orange-50' : 'border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="idType"
                  checked={idDocumentType === 'cni'}
                  onChange={() => setIdDocumentType('cni')}
                  className="accent-[#FF6B00]"
                />
                <span className="text-sm font-bold">CNI / CNIB</span>
              </label>
              <label
                className={`flex items-center gap-2 p-3 border-2 rounded-xl cursor-pointer ${
                  idDocumentType === 'passport'
                    ? 'border-[#FF6B00] bg-orange-50'
                    : 'border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="idType"
                  checked={idDocumentType === 'passport'}
                  onChange={() => setIdDocumentType('passport')}
                  className="accent-[#FF6B00]"
                />
                <span className="text-sm font-bold">Passeport</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Photo / scan CNI ou passeport *</label>
            {!idDocument ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full px-3 py-6 border-2 border-dashed border-gray-300 rounded-xl text-sm flex flex-col items-center justify-center gap-2 hover:border-[#FF6B00]"
              >
                <Upload size={24} className="text-[#FF6B00]" />
                <span className="font-semibold">
                  Uploader votre {idDocumentType === 'passport' ? 'passeport' : 'CNI'}
                </span>
                <span className="text-xs text-gray-400">
                  Photo ou PDF — CNI/CNIB ou passeport SN, BF, ML, GN — max 8 Mo
                </span>
              </button>
            ) : (
              <div
                className={`border-2 rounded-xl p-3 ${
                  idScanOk
                    ? 'border-green-200 bg-green-50'
                    : idScanPending
                      ? 'border-orange-200 bg-orange-50/50'
                      : 'border-red-200 bg-red-50/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{idDocument.name}</p>
                    <p className="text-xs text-gray-600">
                      {idDocumentType === 'passport' ? 'Passeport' : 'CNI'}
                      {idScanPending
                        ? ' · scan en cours…'
                        : idScanOk
                          ? ' · accepté (contrôle admin ensuite)'
                          : ' · refusé'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleIdFileChange(null)}
                    className="p-1 text-gray-500 hover:text-red-600"
                    aria-label="Retirer"
                  >
                    <X size={18} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-2 text-xs font-semibold text-[#FF6B00] hover:underline"
                >
                  Remplacer
                </button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
              className="hidden"
              onChange={(e) => handleIdFileChange(e.target.files?.[0] ?? null)}
            />
            {idDocument && (
              <IdDocumentScanner
                file={idDocument}
                expectedKind={idDocumentType}
                previewUrl={idDocPreview}
                onComplete={handleIdScanComplete}
              />
            )}
            <p className="mt-2 text-xs text-gray-500">
              CNI/CNIB ou passeport officiel (SN, BF, ML, GN). Le type choisi doit correspondre au
              document scanné.
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-1 accent-[#FF6B00]"
            />
            J&apos;accepte les conditions livreur AfriZone
          </label>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || idScanPending || (!!idDocument && !idScanOk)}
            className="w-full py-3 bg-[#FF6B00] text-white rounded-xl font-bold disabled:opacity-50"
          >
            {loading
              ? 'Envoi...'
              : idScanPending
                ? 'Scan en cours…'
                : 'Envoyer ma candidature'}
          </button>
          <p className="text-center text-sm text-gray-500">
            Déjà inscrit ?{' '}
            <Link to="/auth/login" className="text-[#FF6B00] font-semibold">
              Connexion
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
