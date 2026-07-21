import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Eye, EyeOff, ArrowRight, Smartphone, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const loginSchema = z.object({
  phone: z.string().min(10, 'Numéro de téléphone invalide').regex(/^\+?[0-9]{8,15}$/, 'Format de téléphone invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const { login, requestOTP } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    const result = await login(data.phone, data.password);
    
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Une erreur est survenue');
      // Request OTP for password reset option
      if (result.error?.includes('incorrect')) {
        const otpResult = await requestOTP(data.phone, 'login');
        if (otpResult.success) {
          setOtpSent(true);
          setOtpCode(otpResult.code || null);
        }
      }
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo-afrizone.png" alt="AfriZone" className="h-20 w-auto mx-auto" />
          <h1 className="text-2xl font-extrabold text-[#1F2937] mt-4">Connexion</h1>
          <p className="text-gray-500 text-sm mt-1">Accédez à votre compte AfriZone</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Phone */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Numéro de téléphone
              </label>
              <div className="relative">
                <Smartphone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  {...register('phone')}
                  type="tel"
                  placeholder="+221 77 000 00 00"
                  className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                    errors.phone ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-[#FF6B00]'
                  }`}
                />
              </div>
              {errors.phone && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.phone.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-12 py-3 border-2 rounded-xl focus:outline-none transition-colors ${
                    errors.password ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-[#FF6B00]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.password.message}
                </p>
              )}
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded accent-[#FF6B00]" />
                <span className="text-gray-600">Se souvenir</span>
              </label>
              <button type="button" className="text-[#FF6B00] font-semibold hover:underline">
                Mot de passe oublié?
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* OTP Demo */}
            {otpSent && otpCode && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start gap-2">
                <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" />
                <div className="text-green-700 text-sm">
                  <p className="font-semibold">Mode développement</p>
                  <p>Votre code OTP: <span className="font-mono font-bold text-lg">{otpCode}</span></p>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-[#FF6B00] hover:bg-[#E05E00] disabled:bg-gray-300 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="animate-pulse">Connexion en cours...</span>
              ) : (
                <>Se connecter <ArrowRight size={18} /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">ou</span>
            </div>
          </div>

          {/* Register Links */}
          <div className="space-y-3">
            <p className="text-center text-sm text-gray-600">
              Pas encore de compte?{' '}
              <Link to="/auth/register/client" className="text-[#00A651] font-bold hover:underline">
                S'inscrire en tant que Client
              </Link>
            </p>
            <p className="text-center text-sm text-gray-600">
              Vous êtes vendeur?{' '}
              <Link to="/auth/register/vendor" className="text-[#FF6B00] font-bold hover:underline">
                Créer une boutique
              </Link>
            </p>
          </div>
        </div>

        {/* Back to home */}
        <div className="text-center mt-6">
          <Link to="/" className="text-sm text-gray-500 hover:text-[#1F2937] transition-colors">
            ← Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
