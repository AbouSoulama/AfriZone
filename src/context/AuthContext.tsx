import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Vendor, Session, AuthState, OTPRequest } from '../types/auth';

interface AuthContextType extends AuthState {
  login: (phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  registerVendor: (data: VendorRegisterData) => Promise<{ success: boolean; error?: string }>;
  requestOTP: (phone: string, type: 'register' | 'login' | 'password-reset') => Promise<{ success: boolean; code?: string; error?: string }>;
  verifyOTP: (phone: string, code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
}

export interface RegisterData {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
  confirmPassword: string;
  city: string;
  acceptTerms: boolean;
  otpCode?: string;
}

export interface VendorRegisterData {
  // Step 1
  fullName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  idDocument: File | null;
  idDocumentType: 'cni' | 'passport';
  // Step 2
  shopName: string;
  country: 'SN' | 'BF';
  city: string;
  address: string;
  shopCategory: string;
  shopDescription: string;
  shopLogo: File | null;
  commerceRegister?: string;
  acceptTerms: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Simulated database storage
const STORAGE_KEYS = {
  USERS: 'afrizone_users',
  VENDORS: 'afrizone_vendors',
  SESSION: 'afrizone_session',
  OTP: 'afrizone_otp',
};

function generateId(): string {
  return 'usr_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function generateVendorCode(country: 'SN' | 'BF', city: string): string {
  const cityCode = city.toUpperCase().substring(0, 3);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${country}-${cityCode}-${random}`;
}

function hashPassword(password: string): string {
  // Simple hash for demo (use bcrypt in production)
  return btoa(password + '_afrizone_salt_2026');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Load session on mount
  useEffect(() => {
    const loadSession = () => {
      try {
        const sessionStr = localStorage.getItem(STORAGE_KEYS.SESSION);
        if (sessionStr) {
          const session: Session = JSON.parse(sessionStr);
          if (new Date(session.expiresAt) > new Date()) {
            setState({
              user: session.user,
              session,
              isAuthenticated: true,
              isLoading: false,
            });
            return;
          }
        }
      } catch (e) {
        console.error('Failed to load session', e);
      }
      setState(prev => ({ ...prev, isLoading: false }));
    };
    loadSession();
  }, []);

  // Simulated OTP storage
  const otpStore = new Map<string, OTPRequest>();

  const requestOTP = async (phone: string, type: 'register' | 'login' | 'password-reset'): Promise<{ success: boolean; code?: string; error?: string }> => {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    const otp: OTPRequest = {
      phone,
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      verified: false,
      type,
    };
    
    otpStore.set(phone, otp);
    
    // Store in localStorage for persistence
    const otps = JSON.parse(localStorage.getItem(STORAGE_KEYS.OTP) || '[]');
    otps.push(otp);
    localStorage.setItem(STORAGE_KEYS.OTP, JSON.stringify(otps));

    // Simulate SMS sending
    console.log(`📱 SMS OTP sent to ${phone}: ${code}`);
    
    // In development, return the code for testing
    return { success: true, code };
  };

  const verifyOTP = async (phone: string, code: string): Promise<{ success: boolean; error?: string }> => {
    const otp = otpStore.get(phone);
    if (!otp) {
      return { success: false, error: 'Code OTP non trouvé. Veuillez en demander un nouveau.' };
    }
    if (otp.expiresAt < new Date()) {
      otpStore.delete(phone);
      return { success: false, error: 'Code OTP expiré. Veuillez en demander un nouveau.' };
    }
    if (otp.code !== code) {
      return { success: false, error: 'Code OTP incorrect.' };
    }
    otp.verified = true;
    otpStore.set(phone, otp);
    return { success: true };
  };

  const login = async (phone: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
      const vendors = JSON.parse(localStorage.getItem(STORAGE_KEYS.VENDORS) || '[]');
      const allUsers = [...users, ...vendors];
      
      const user = allUsers.find((u: any) => u.phone === phone && u.password === hashPassword(password));
      
      if (!user) {
        return { success: false, error: 'Numéro de téléphone ou mot de passe incorrect.' };
      }

      if (user.role === 'vendeur' && user.status === 'pending') {
        return { success: false, error: 'Votre compte vendeur est en attente de validation par l\'administrateur.' };
      }

      if (user.role === 'vendeur' && user.status === 'rejected') {
        return { success: false, error: 'Votre compte vendeur a été refusé. Veuillez contacter le support.' };
      }

      const session: Session = {
        user,
        token: 'tok_' + Math.random().toString(36).substr(2),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };

      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
      
      setState({
        user,
        session,
        isAuthenticated: true,
        isLoading: false,
      });

      return { success: true };
    } catch (e) {
      console.error('Login error', e);
      return { success: false, error: 'Une erreur est survenue lors de la connexion.' };
    }
  };

  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
    try {
      const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
      
      if (users.some((u: any) => u.phone === data.phone)) {
        return { success: false, error: 'Ce numéro de téléphone est déjà utilisé.' };
      }

      if (data.email && users.some((u: any) => u.email === data.email)) {
        return { success: false, error: 'Cet email est déjà utilisé.' };
      }

      if (data.password !== data.confirmPassword) {
        return { success: false, error: 'Les mots de passe ne correspondent pas.' };
      }

      if (!data.acceptTerms) {
        return { success: false, error: 'Vous devez accepter les conditions générales de vente.' };
      }

      const newUser: User = {
        id: generateId(),
        fullName: data.fullName,
        phone: data.phone,
        email: data.email,
        role: 'client',
        city: data.city,
        createdAt: new Date(),
        verified: true,
      };
      (newUser as any).password = hashPassword(data.password);

      users.push(newUser);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

      // Auto login after registration
      const session: Session = {
        user: newUser,
        token: 'tok_' + Math.random().toString(36).substr(2),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));

      setState({
        user: newUser,
        session,
        isAuthenticated: true,
        isLoading: false,
      });

      return { success: true };
    } catch (e) {
      console.error('Register error', e);
      return { success: false, error: 'Une erreur est survenue lors de l\'inscription.' };
    }
  };

  const registerVendor = async (data: VendorRegisterData): Promise<{ success: boolean; error?: string }> => {
    try {
      const vendors = JSON.parse(localStorage.getItem(STORAGE_KEYS.VENDORS) || '[]');
      
      if (vendors.some((v: any) => v.phone === data.phone)) {
        return { success: false, error: 'Ce numéro de téléphone est déjà utilisé.' };
      }

      if (vendors.some((v: any) => v.email === data.email)) {
        return { success: false, error: 'Cet email est déjà utilisé.' };
      }

      if (data.password !== data.confirmPassword) {
        return { success: false, error: 'Les mots de passe ne correspondent pas.' };
      }

      if (!data.acceptTerms) {
        return { success: false, error: 'Vous devez accepter les conditions générales de vente.' };
      }

      const vendorCode = generateVendorCode(data.country, data.city);

      const newVendor: Vendor = {
        id: generateId(),
        fullName: data.fullName,
        phone: data.phone,
        email: data.email,
        role: 'vendeur',
        status: 'pending',
        shopName: data.shopName,
        shopDescription: data.shopDescription,
        shopCategory: data.shopCategory,
        vendorCode,
        country: data.country,
        city: data.city,
        address: data.address,
        commerceRegister: data.commerceRegister,
        createdAt: new Date(),
        verified: false,
      };
      (newVendor as any).password = hashPassword(data.password);

      vendors.push(newVendor);
      localStorage.setItem(STORAGE_KEYS.VENDORS, JSON.stringify(vendors));

      return { success: true, error: undefined };
    } catch (e) {
      console.error('Vendor register error', e);
      return { success: false, error: 'Une erreur est survenue lors de l\'inscription.' };
    }
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    setState({
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  const updateUser = (data: Partial<User>) => {
    if (state.user) {
      const updatedUser = { ...state.user, ...data };
      const session: Session = {
        ...state.session!,
        user: updatedUser,
      };
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
      setState(prev => ({
        ...prev,
        user: updatedUser,
        session,
      }));
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, registerVendor, requestOTP, verifyOTP, logout, updateUser }}>
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
