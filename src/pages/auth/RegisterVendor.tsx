import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle,
  Smartphone,
  Upload,
  FileText,
  Store,
  Globe,
  Building,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const step1Schema = z
  .object({
    fullName: z.string().min(3, 'Le nom complet doit contenir au moins 3 caractères'),
    phone: z.string().min(8, 'Numéro de téléphone invalide'),
    email: z.string().email('Email invalide'),
    password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
    confirmPassword: z.string(),
    idDocumentType: z.enum(['cni', 'passport']),
    acceptTerms: z.boolean().refine((val) => val === true, 'Vous devez accepter les CGV'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

const step2Schema = z.object({
  shopName: z.string().min(3, 'Le nom de la boutique doit contenir au moins 3 caractères'),
  country: z.enum(['SN', 'BF', 'ML']),
  city: z.string().min(2, 'Ville requise'),
  address: z.string().min(5, 'Adresse physique requise'),
  shopCategory: z.string().min(2, 'Catégorie requise'),
  shopDescription: z.string().min(10, 'Description trop courte'),
  commerceRegister: z.string().optional(),
});

type Step1FormData = z.infer<typeof step1Schema>;
type Step2FormData = z.infer<typeof step2Schema>;
type Step = 1 | 2 | 3;

const citiesByCountry: Record<string, string[]> = {
  SN: ['Dakar', 'Thies', 'Saint-Louis', 'Ziguinchor', 'Kaolack', 'Touba'],
  BF: ['Ouagadougou', 'Bobo-Dioulasso', 'Koudougou', 'Banfora', 'Ouahigouya', 'Kaya'],
  ML: ['Bamako', 'Sikasso', 'Segou', 'Mopti', 'Kayes'],
};

const shopCategories = [
  'Électronique',
  'Mode & Vêtements',
  'Maison & Décoration',
  'Beauté & Cosmétiques',
  'Alimentation',
  'Sport & Loisirs',
  'Livres & Papeterie',
  'Auto & Moto',
  'Téléphonie',
  'Informatique',
  'Artisanat',
  'Autre',
];

export default function RegisterVendor() {
  const navigate = useNavigate();
  const { registerVendor } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step1Data, setStep1Data] = useState<Step1FormData | null>(null);
  const [vendorCode, setVendorCode] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [country, setCountry] = useState<'SN' | 'BF' | 'ML'>('SN');
  const [idDocFile, setIdDocFile] = useState<File | null>(null);
  const [shopLogoFile, setShopLogoFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const {
    register: reg1,
    handleSubmit: handleSubmit1,
    formState: { errors: errors1 },
    watch: watch1,
  } = useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
    defaultValues: { idDocumentType: 'cni', acceptTerms: false },
  });

  const {
    register: reg2,
    handleSubmit: handleSubmit2,
    formState: { errors: errors2 },
    setValue: setValue2,
    watch: watch2,
  } = useForm<Step2FormData>({
    resolver: zodResolver(step2Schema),
    defaultValues: { country: 'SN', city: 'Dakar' },
  });

  const handleStep1Submit = (data: Step1FormData) => {
    if (!idDocFile) {
      setError("Veuillez uploader votre pièce d'identité");
      return;
    }
    setStep1Data(data);
    setStep(2);
    setError(null);
  };

  const handleStep2Submit = async (data: Step2FormData) => {
    if (!step1Data) return;
    setIsLoading(true);
    setError(null);

    const result = await registerVendor({
      fullName: step1Data.fullName,
      phone: step1Data.phone,
      email: step1Data.email,
      password: step1Data.password,
      confirmPassword: step1Data.confirmPassword,
      idDocument: idDocFile,
      idDocumentType: step1Data.idDocumentType,
      shopName: data.shopName,
      country: data.country,
      city: data.city,
      address: data.address,
      shopCategory: data.shopCategory,
      shopDescription: data.shopDescription,
      shopLogo: shopLogoFile,
      commerceRegister: data.commerceRegister,
      acceptTerms: step1Data.acceptTerms,
    });

    if (result.success) {
      setVendorCode(result.vendorCode || null);
      setInfoMessage(result.needsEmailConfirmation ? result.error || null : null);
      setStep(3);
    } else {
      setError(result.error || 'Une erreur est survenue');
    }
    setIsLoading(false);
  };

  if (step === 3) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={40} className="text-[#FF6B00]" />
            </div>
            <h1 className="text-2xl font-extrabold text-[#1F2937] mb-2">Demande envoyée!</h1>
            <p className="text-gray-500 mb-4">
              Votre dossier vendeur a été soumis. Notre équipe l&apos;examinera sous 24-48h.
            </p>
            {vendorCode && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-500 mb-1">Code vendeur :</p>
                <p className="text-2xl font-mono font-bold text-[#FF6B00]">{vendorCode}</p>
              </div>
            )}
            {infoMessage && <p className="text-sm text-amber-700 mb-4">{infoMessage}</p>}
            <button
              onClick={() => navigate('/auth/login')}
              className="w-full py-3.5 bg-[#00A651] hover:bg-[#008A43] text-white rounded-xl font-bold transition-all shadow-lg"
            >
              Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <Link to="/">
            <img src="/logo-afrizone.png" alt="AfriZone" className="h-16 w-auto mx-auto" />
          </Link>
          <h1 className="text-2xl font-extrabold text-[#1F2937] mt-3">Devenir Vendeur AfriZone</h1>
          <p className="text-gray-500 text-sm mt-1">Rejoignez des milliers de vendeurs africains</p>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <div className={`flex-1 h-2 rounded-full ${step >= 1 ? 'bg-[#FF6B00]' : 'bg-gray-200'}`} />
          <div className={`flex-1 h-2 rounded-full ${step >= 2 ? 'bg-[#FF6B00]' : 'bg-gray-200'}`} />
        </div>
        <div className="flex justify-between text-xs font-semibold text-gray-500 mb-6">
          <span>Informations personnelles</span>
          <span>Informations boutique</span>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {step === 1 && (
            <form onSubmit={handleSubmit1(handleStep1Submit)} className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Smartphone size={20} className="text-[#FF6B00]" />
                <h2 className="text-lg font-bold text-[#1F2937]">Étape 1: Informations personnelles</h2>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Nom complet</label>
                <input
                  {...reg1('fullName')}
                  type="text"
                  placeholder="Ex: Mamadou Diop"
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none ${
                    errors1.fullName ? 'border-red-300' : 'border-gray-200 focus:border-[#FF6B00]'
                  }`}
                />
                {errors1.fullName && (
                  <p className="text-red-500 text-xs mt-1">{String(errors1.fullName.message)}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Téléphone</label>
                <div className="relative">
                  <Smartphone
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    {...reg1('phone')}
                    type="tel"
                    placeholder="+221 77 000 00 00"
                    className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none ${
                      errors1.phone ? 'border-red-300' : 'border-gray-200 focus:border-[#FF6B00]'
                    }`}
                  />
                </div>
                {errors1.phone && (
                  <p className="text-red-500 text-xs mt-1">{String(errors1.phone.message)}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    {...reg1('email')}
                    type="email"
                    placeholder="votre@email.com"
                    className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none ${
                      errors1.email ? 'border-red-300' : 'border-gray-200 focus:border-[#FF6B00]'
                    }`}
                  />
                </div>
                {errors1.email && (
                  <p className="text-red-500 text-xs mt-1">{String(errors1.email.message)}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Mot de passe</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    {...reg1('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`w-full pl-10 pr-12 py-3 border-2 rounded-xl focus:outline-none ${
                      errors1.password ? 'border-red-300' : 'border-gray-200 focus:border-[#FF6B00]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors1.password && (
                  <p className="text-red-500 text-xs mt-1">{String(errors1.password.message)}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Confirmation mot de passe
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    {...reg1('confirmPassword')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none ${
                      errors1.confirmPassword
                        ? 'border-red-300'
                        : 'border-gray-200 focus:border-[#FF6B00]'
                    }`}
                  />
                </div>
                {errors1.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1">{String(errors1.confirmPassword.message)}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Type de pièce d&apos;identité
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer ${
                      watch1('idDocumentType') === 'cni'
                        ? 'border-[#FF6B00] bg-orange-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <input {...reg1('idDocumentType')} type="radio" value="cni" className="accent-[#FF6B00]" />
                    <div>
                      <p className="font-bold text-sm">CNI</p>
                      <p className="text-xs text-gray-500">Carte Nationale</p>
                    </div>
                  </label>
                  <label
                    className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer ${
                      watch1('idDocumentType') === 'passport'
                        ? 'border-[#FF6B00] bg-orange-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <input
                      {...reg1('idDocumentType')}
                      type="radio"
                      value="passport"
                      className="accent-[#FF6B00]"
                    />
                    <div>
                      <p className="font-bold text-sm">Passeport</p>
                      <p className="text-xs text-gray-500">Passeport valide</p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  <FileText size={14} className="inline mr-1" /> Photo de la pièce d&apos;identité
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-[#FF6B00]"
                >
                  <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">Cliquez pour uploader</p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF - Max 5MB</p>
                  {idDocFile && (
                    <p className="text-xs text-green-600 mt-2 font-semibold">✓ {idDocFile.name}</p>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => setIdDocFile(e.target.files?.[0] || null)}
                />
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input {...reg1('acceptTerms')} type="checkbox" className="mt-1 rounded accent-[#FF6B00]" />
                <span className="text-sm text-gray-600">
                  J&apos;accepte les{' '}
                  <a href="#" className="text-[#FF6B00] underline">
                    Conditions Générales Vendeurs
                  </a>
                </span>
              </label>
              {errors1.acceptTerms && (
                <p className="text-red-500 text-xs">{String(errors1.acceptTerms.message)}</p>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 bg-[#FF6B00] hover:bg-[#E05E00] text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
              >
                Suivant <ArrowRight size={18} />
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit2(handleStep2Submit)} className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Store size={20} className="text-[#00A651]" />
                <h2 className="text-lg font-bold text-[#1F2937]">Étape 2: Informations boutique</h2>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Nom de la boutique</label>
                <div className="relative">
                  <Store size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    {...reg2('shopName')}
                    type="text"
                    placeholder="Ex: TechDakar"
                    className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none ${
                      errors2.shopName ? 'border-red-300' : 'border-gray-200 focus:border-[#00A651]'
                    }`}
                  />
                </div>
                {errors2.shopName && (
                  <p className="text-red-500 text-xs mt-1">{String(errors2.shopName.message)}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Pays</label>
                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      { code: 'SN', label: 'Sénégal' },
                      { code: 'BF', label: 'Burkina Faso' },
                      { code: 'ML', label: 'Mali' },
                    ] as const
                  ).map((p) => (
                    <label
                      key={p.code}
                      className={`flex items-center gap-2 p-3 border-2 rounded-xl cursor-pointer ${
                        watch2('country') === p.code
                          ? 'border-[#00A651] bg-green-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <input
                        {...reg2('country')}
                        type="radio"
                        value={p.code}
                        className="accent-[#00A651]"
                        onChange={(e) => {
                          reg2('country').onChange(e);
                          setCountry(p.code);
                          setValue2('city', citiesByCountry[p.code][0]);
                        }}
                      />
                      <div className="flex items-center gap-1">
                        <Globe size={14} className="text-green-600" />
                        <p className="font-bold text-xs">{p.label}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Ville</label>
                <select
                  {...reg2('city')}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#00A651] focus:outline-none bg-white"
                >
                  {citiesByCountry[country].map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Adresse physique</label>
                <div className="relative">
                  <Building
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    {...reg2('address')}
                    type="text"
                    placeholder="Quartier, rue..."
                    className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none ${
                      errors2.address ? 'border-red-300' : 'border-gray-200 focus:border-[#00A651]'
                    }`}
                  />
                </div>
                {errors2.address && (
                  <p className="text-red-500 text-xs mt-1">{String(errors2.address.message)}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Catégorie principale</label>
                <select
                  {...reg2('shopCategory')}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#00A651] focus:outline-none bg-white"
                >
                  <option value="">Sélectionner</option>
                  {shopCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                {errors2.shopCategory && (
                  <p className="text-red-500 text-xs mt-1">{String(errors2.shopCategory.message)}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Description de la boutique
                </label>
                <textarea
                  {...reg2('shopDescription')}
                  rows={3}
                  placeholder="Décrivez votre boutique..."
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none resize-none ${
                    errors2.shopDescription
                      ? 'border-red-300'
                      : 'border-gray-200 focus:border-[#00A651]'
                  }`}
                />
                {errors2.shopDescription && (
                  <p className="text-red-500 text-xs mt-1">{String(errors2.shopDescription.message)}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Logo boutique <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <div
                  onClick={() => logoInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-[#00A651]"
                >
                  <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">Cliquez pour uploader un logo</p>
                  {shopLogoFile && (
                    <p className="text-xs text-green-600 mt-2 font-semibold">✓ {shopLogoFile.name}</p>
                  )}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setShopLogoFile(e.target.files?.[0] || null)}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  <CreditCard size={14} className="inline mr-1" /> Registre de commerce{' '}
                  <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <input
                  {...reg2('commerceRegister')}
                  type="text"
                  placeholder="Ex: SN-DKR-2024-B-12345"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#00A651] focus:outline-none"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3.5 border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:border-gray-300"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3.5 bg-[#00A651] hover:bg-[#008A43] disabled:bg-gray-300 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
                >
                  {isLoading ? (
                    'Envoi...'
                  ) : (
                    <>
                      Soumettre <CheckCircle size={18} />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="text-center mt-6">
          <Link to="/auth/login" className="text-sm text-gray-500 hover:text-[#1F2937]">
            ← Déjà un compte? Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}
