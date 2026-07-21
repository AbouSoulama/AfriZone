import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Mail, Lock, Eye, EyeOff, MapPin, ArrowRight, AlertCircle, CheckCircle, Smartphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const registerSchema = z.object({
  fullName: z.string().min(3, 'Le nom complet doit contenir au moins 3 caractères'),
  phone: z.string().min(10, 'Numéro de téléphone invalide').regex(/^\+?[0-9]{8,15}$/, 'Format de téléphone invalide'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  confirmPassword: z.string(),
  city: z.enum(['Dakar', 'Ouagadougou', 'Bamako', 'Abidjan', 'Lomé', 'Cotonou']),
  acceptTerms: z.boolean().refine(val => val === true, 'Vous devez accepter les CGV'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

type Step = 'form' | 'otp' | 'success';

export default function RegisterClient() {
  const navigate = useNavigate();
  const { register: registerUser, requestOTP, verifyOTP } = useAuth();
  const [step, setStep] = useState<Step>('form');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [formData, setFormData] = useState<Partial<RegisterFormData>>({});

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      city: 'Dakar',
      acceptTerms: false,
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setFormData(data);
    setIsLoading(true);
    setError(null);

    // Request OTP
    const result = await requestOTP(data.phone, 'register');
    
    if (result.success) {
      setOtpCode(result.code || null);
      setStep('otp');
    } else {
      setError(result.error || 'Une erreur est survenue');
    }
    
    setIsLoading(false);
  };

  const handleVerifyOTP = async () => {
    if (!formData.phone || !otpInput) return;
    
    setIsLoading(true);
    setError(null);

    const result = await verifyOTP(formData.phone, otpInput);
    
    if (result.success) {
      // Complete registration
      const regResult = await registerUser({
        fullName: formData.fullName!,
        phone: formData.phone!,
        email: formData.email,
        password: formData.password!,
        confirmPassword: formData.confirmPassword!,
        city: formData.city!,
        acceptTerms: true,
      });

      if (regResult.success) {
        setStep('success');
      } else {
        setError(regResult.error || 'Une erreur est survenue');
      }
    } else {
      setError(result.error || 'Code OTP incorrect');
    }
    
    setIsLoading(false);
  };

  const handleResendOTP = async () => {
    if (!formData.phone) return;
    
    setIsLoading(true);
    const result = await requestOTP(formData.phone, 'register');
    if (result.success) {
      setOtpCode(result.code || null);
    }
    setIsLoading(false);
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={40} className="text-[#00A651]" />
            </div>
            <h1 className="text-2xl font-extrabold text-[#1F2937] mb-2">Inscription réussie!</h1>
            <p className="text-gray-500 mb-6">
              Bienvenue sur AfriZone, {formData.fullName?.split(' ')[0]}! Votre compte client a été créé avec succès.
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3.5 bg-[#00A651] hover:bg-[#008A43] text-white rounded-xl font-bold transition-all shadow-lg"
            >
              Commencer à acheter
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <img src="/logo-afrizone.png" alt="AfriZone" className="h-16 w-auto mx-auto" />
          <h1 className="text-2xl font-extrabold text-[#1F2937] mt-3">Créer un compte Client</h1>
          <p className="text-gray-500 text-sm mt-1">Accédez aux meilleures offres africaines</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          <div className={`flex-1 h-2 rounded-full ${step === 'form' ? 'bg-[#FF6B00]' : 'bg-green-500'}`} />
          <div className={`flex-1 h-2 rounded-full ${step !== 'form' ? 'bg-green-500' : 'bg-gray-200'}`} />
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {step === 'form' && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Nom complet</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    {...register('fullName')}
                    type="text"
                    placeholder="Ex: Mamadou Diop"
                    className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none ${
                      errors.fullName ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-[#FF6B00]'
                    }`}
                  />
                </div>
                {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Téléphone</label>
                <div className="relative">
                  <Smartphone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    {...register('phone')}
                    type="tel"
                    placeholder="+221 77 000 00 00"
                    className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none ${
                      errors.phone ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-[#FF6B00]'
                    }`}
                  />
                </div>
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
              </div>

              {/* Email (optional) */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Email <span className="text-gray-400 font-normal">(optionnel)</span></label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    {...register('email')}
                    type="email"
                    placeholder="votre@email.com"
                    className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none ${
                      errors.email ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-[#FF6B00]'
                    }`}
                  />
                </div>
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Mot de passe</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`w-full pl-10 pr-12 py-3 border-2 rounded-xl focus:outline-none ${
                      errors.password ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-[#FF6B00]'
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
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Confirmation mot de passe</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    {...register('confirmPassword')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none ${
                      errors.confirmPassword ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-[#FF6B00]'
                    }`}
                  />
                </div>
                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
              </div>

              {/* City */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Ville</label>
                <div className="relative">
                  <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select
                    {...register('city')}
                    className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none appearance-none bg-white ${
                      errors.city ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-[#FF6B00]'
                    }`}
                  >
                    <option value="Dakar">Dakar</option>
                    <option value="Ouagadougou">Ouagadougou</option>
                    <option value="Bamako">Bamako</option>
                    <option value="Abidjan">Abidjan</option>
                    <option value="Lomé">Lomé</option>
                    <option value="Cotonou">Cotonou</option>
                  </select>
                </div>
                {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
              </div>

              {/* CGV Checkbox */}
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  {...register('acceptTerms')}
                  type="checkbox"
                  className="mt-1 rounded accent-[#FF6B00]"
                />
                <span className="text-sm text-gray-600">
                  J'accepte les <a href="#" className="text-[#FF6B00] underline">Conditions Générales de Vente</a> et la <a href="#" className="text-[#FF6B00] underline">Politique de confidentialité</a>
                </span>
              </label>
              {errors.acceptTerms && <p className="text-red-500 text-xs">{errors.acceptTerms.message}</p>}

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-[#FF6B00] hover:bg-[#E05E00] disabled:bg-gray-300 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
              >
                {isLoading ? 'Envoi du code...' : <>Recevoir le code SMS <ArrowRight size={18} /></>}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Smartphone size={32} className="text-[#FF6B00]" />
                </div>
                <h2 className="text-xl font-bold text-[#1F2937]">Vérification SMS</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Entrez le code à 6 chiffres envoyé au <span className="font-semibold">{formData.phone}</span>
                </p>
              </div>

              {/* OTP Display (dev only) */}
              {otpCode && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-green-700 mb-1">Mode développement - Code OTP:</p>
                  <p className="text-2xl font-mono font-bold text-green-600 tracking-widest">{otpCode}</p>
                </div>
              )}

              {/* OTP Input */}
              <div>
                <input
                  type="text"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full text-center text-2xl font-mono tracking-[0.5em] py-4 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={handleVerifyOTP}
                  disabled={isLoading || otpInput.length !== 6}
                  className="w-full py-3.5 bg-[#00A651] hover:bg-[#008A43] disabled:bg-gray-300 text-white rounded-xl font-bold transition-all shadow-lg"
                >
                  {isLoading ? 'Vérification...' : 'Vérifier le code'}
                </button>
                <button
                  onClick={handleResendOTP}
                  disabled={isLoading}
                  className="w-full py-3 text-[#FF6B00] font-semibold hover:underline disabled:opacity-50"
                >
                  Renvoyer le code
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Back to login */}
        <div className="text-center mt-6">
          <Link to="/auth/login" className="text-sm text-gray-500 hover:text-[#1F2937] transition-colors">
            ← Déjà un compte? Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}
