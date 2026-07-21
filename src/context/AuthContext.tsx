import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  authEmailFromPhone,
  generateVendorCode,
  isEmail,
  isSyntheticAuthEmail,
  mapAuthError,
  normalizePhone,
  slugify,
  validateIdDocument,
} from '../lib/auth-helpers';
import type {
  AuthResult,
  AuthState,
  AuthUser,
  RegisterData,
  VendorProfile,
  VendorRegisterData,
  UserRole,
} from '../types/auth';

interface AuthContextType extends AuthState {
  login: (identifier: string, password: string) => Promise<AuthResult>;
  register: (data: RegisterData) => Promise<AuthResult>;
  registerVendor: (data: VendorRegisterData) => Promise<AuthResult>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapProfile(row: Record<string, unknown>, vendor?: VendorProfile | null): AuthUser {
  return {
    id: row.id as string,
    fullName: row.full_name as string,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    role: row.role as UserRole,
    city: (row.city as string) ?? null,
    avatarUrl: (row.avatar_url as string) ?? null,
    verified: Boolean(row.verified),
    createdAt: row.created_at as string,
    vendor: vendor ?? null,
  };
}

function mapVendor(row: Record<string, unknown>): VendorProfile {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    status: row.status as VendorProfile['status'],
    shopName: row.shop_name as string,
    shopSlug: row.shop_slug as string,
    shopDescription: (row.shop_description as string) ?? null,
    shopCategory: (row.shop_category as string) ?? null,
    shopLogoUrl: (row.shop_logo_url as string) ?? null,
    vendorCode: row.vendor_code as string,
    country: row.country as string,
    city: row.city as string,
    address: (row.address as string) ?? null,
    commerceRegister: (row.commerce_register as string) ?? null,
    idDocumentUrl: (row.id_document_url as string) ?? null,
    idDocumentType: (row.id_document_type as string) ?? null,
  };
}

async function resolveLoginEmail(identifier: string): Promise<string | null> {
  const value = identifier.trim();
  if (isEmail(value)) return value.toLowerCase();

  const phone = normalizePhone(value);
  const { data } = await supabase
    .from('profiles')
    .select('email')
    .eq('phone', phone)
    .maybeSingle();

  if (data?.email) return data.email as string;
  return authEmailFromPhone(phone);
}

async function uploadPrivateFile(
  bucket: string,
  userId: string,
  file: File,
  folder: string
): Promise<string> {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${userId}/${folder}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

async function uploadPublicFile(
  bucket: string,
  userId: string,
  file: File,
  folder: string
): Promise<string> {
  const path = await uploadPrivateFile(bucket, userId, file, folder);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const loadUser = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setState({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    const userId = session.user.id;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !profile) {
      console.error('Failed to load profile', error);
      setState({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    let vendor: VendorProfile | null = null;
    if (profile.role === 'vendeur') {
      const { data: vendorRow } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (vendorRow) vendor = mapVendor(vendorRow);
    }

    setState({
      user: mapProfile(profile, vendor),
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) loadUser(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUser(session);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadUser]);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await loadUser(data.session);
  }, [loadUser]);

  const login = async (identifier: string, password: string): Promise<AuthResult> => {
    try {
      const email = await resolveLoginEmail(identifier);
      if (!email) {
        return { success: false, error: 'Identifiant invalide.' };
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { success: false, error: mapAuthError(error.message) };

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profile?.role === 'vendeur') {
          const { data: vendor } = await supabase
            .from('vendors')
            .select('status, vendor_code, shop_name')
            .eq('user_id', data.user.id)
            .maybeSingle();

          // Pas de fiche boutique = inscription incomplète
          if (!vendor) {
            await supabase.auth.signOut();
            return {
              success: false,
              error:
                "Votre inscription vendeur est incomplète (boutique non créée). Recommencez l'inscription vendeur ou contactez le support.",
            };
          }

          if (vendor.status === 'pending') {
            await supabase.auth.signOut();
            return {
              success: false,
              error: `Compte vendeur « ${vendor.shop_name} » (${vendor.vendor_code}) en attente de validation admin.`,
            };
          }
          if (vendor.status === 'rejected' || vendor.status === 'suspended') {
            await supabase.auth.signOut();
            return {
              success: false,
              error: 'Votre compte vendeur n’est pas actif. Contactez le support.',
            };
          }
        }

        return { success: true, role: (profile?.role as UserRole) || 'client' };
      }

      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: 'Une erreur est survenue lors de la connexion.' };
    }
  };

  const register = async (data: RegisterData): Promise<AuthResult> => {
    try {
      if (data.password !== data.confirmPassword) {
        return { success: false, error: 'Les mots de passe ne correspondent pas.' };
      }
      if (!data.acceptTerms) {
        return { success: false, error: 'Vous devez accepter les conditions générales.' };
      }

      const phone = normalizePhone(data.phone);
      const email = data.email?.trim()
        ? data.email.trim().toLowerCase()
        : authEmailFromPhone(phone);

      const { data: existingPhone } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      if (existingPhone) {
        return { success: false, error: 'Ce numéro de téléphone est déjà utilisé.' };
      }

      const { data: authData, error } = await supabase.auth.signUp({
        email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            phone,
            city: data.city,
            role: 'client',
            email: data.email?.trim() || null,
          },
        },
      });

      if (error) return { success: false, error: mapAuthError(error.message) };

      if (authData.user) {
        await supabase
          .from('profiles')
          .update({
            phone,
            full_name: data.fullName,
            city: data.city,
            email: isSyntheticAuthEmail(email) ? null : email,
            role: 'client',
          })
          .eq('id', authData.user.id);
      }

      if (!authData.session) {
        return {
          success: true,
          needsEmailConfirmation: true,
        };
      }

      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: "Une erreur est survenue lors de l'inscription." };
    }
  };

  const registerVendor = async (data: VendorRegisterData): Promise<AuthResult> => {
    try {
      if (data.password !== data.confirmPassword) {
        return { success: false, error: 'Les mots de passe ne correspondent pas.' };
      }
      if (!data.acceptTerms) {
        return { success: false, error: 'Vous devez accepter les conditions générales.' };
      }

      const idError = validateIdDocument(data.idDocument);
      if (idError || !data.idDocument) {
        return { success: false, error: idError || "Pièce d'identité manquante." };
      }

      const phone = normalizePhone(data.phone);
      const email = data.email.trim().toLowerCase();

      const { data: existingPhone } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      if (existingPhone) {
        return { success: false, error: 'Ce numéro de téléphone est déjà utilisé.' };
      }

      // Créer le compte Auth — rôle vendeur uniquement après création boutique
      const { data: authData, error } = await supabase.auth.signUp({
        email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            phone,
            city: data.city,
            role: 'vendeur',
            email,
          },
        },
      });

      if (error) return { success: false, error: mapAuthError(error.message) };
      if (!authData.user) {
        return { success: false, error: 'Impossible de créer le compte.' };
      }

      const userId = authData.user.id;

      // Garantir une session (upload Storage + insert vendors exigent d'être connecté)
      let session = authData.session;
      if (!session) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: data.password,
        });
        if (signInError || !signInData.session) {
          return {
            success: false,
            error:
              'Compte créé mais session impossible. Dans Supabase → Authentication → Providers → Email, désactivez « Confirm email », puis réessayez avec un nouvel email.',
          };
        }
        session = signInData.session;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          phone,
          full_name: data.fullName,
          city: data.city,
          email,
          role: 'vendeur',
        })
        .eq('id', userId);

      if (profileError) {
        console.error(profileError);
        await supabase.auth.signOut();
        return { success: false, error: `Erreur profil : ${profileError.message}` };
      }

      let idDocumentPath: string;
      try {
        idDocumentPath = await uploadPrivateFile(
          'vendor-documents',
          userId,
          data.idDocument,
          'identity'
        );
      } catch (uploadErr) {
        console.error(uploadErr);
        await supabase.auth.signOut();
        return {
          success: false,
          error:
            "Impossible d'uploader la pièce d'identité. Vérifiez que le bucket « vendor-documents » existe dans Supabase Storage.",
        };
      }

      let shopLogoUrl: string | null = null;
      if (data.shopLogo) {
        try {
          shopLogoUrl = await uploadPublicFile('avatars', userId, data.shopLogo, 'shop-logo');
        } catch (logoErr) {
          console.error(logoErr);
          // Logo optionnel : on continue sans bloquer
        }
      }

      const vendorCode = generateVendorCode(data.country, data.city);
      const baseSlug = slugify(data.shopName) || 'boutique';
      const shopSlug = `${baseSlug}-${vendorCode.toLowerCase()}`;

      const { error: vendorError } = await supabase.from('vendors').insert({
        user_id: userId,
        status: 'pending',
        vendor_code: vendorCode,
        shop_name: data.shopName,
        shop_slug: shopSlug,
        shop_description: data.shopDescription,
        shop_category: data.shopCategory,
        shop_logo_url: shopLogoUrl,
        country: data.country,
        city: data.city,
        address: data.address,
        commerce_register: data.commerceRegister || null,
        id_document_url: idDocumentPath,
        id_document_type: data.idDocumentType,
      });

      if (vendorError) {
        console.error(vendorError);
        await supabase.auth.signOut();
        return {
          success: false,
          error: vendorError.message.includes('duplicate')
            ? 'Cette boutique ou ce code existe déjà. Réessayez.'
            : `Erreur création boutique : ${vendorError.message}`,
        };
      }

      // Vendeur pending : pas de session active
      await supabase.auth.signOut();

      return { success: true, vendorCode };
    } catch (e) {
      console.error(e);
      await supabase.auth.signOut();
      return { success: false, error: "Une erreur est survenue lors de l'inscription vendeur." };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setState({ user: null, isAuthenticated: false, isLoading: false });
  };

  const requestPasswordReset = async (email: string): Promise<AuthResult> => {
    try {
      const redirectTo = `${window.location.origin}/auth/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo,
      });
      if (error) return { success: false, error: mapAuthError(error.message) };
      return { success: true };
    } catch {
      return { success: false, error: "Impossible d'envoyer l'email de réinitialisation." };
    }
  };

  const updatePassword = async (password: string): Promise<AuthResult> => {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { success: false, error: mapAuthError(error.message) };
      return { success: true };
    } catch {
      return { success: false, error: 'Impossible de mettre à jour le mot de passe.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        registerVendor,
        logout,
        requestPasswordReset,
        updatePassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
