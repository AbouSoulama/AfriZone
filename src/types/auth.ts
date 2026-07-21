export type UserRole = 'client' | 'vendeur' | 'admin' | 'livreur';
export type VendorStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface Profile {
  id: string;
  email?: string | null;
  phone: string | null;
  fullName: string;
  role: UserRole;
  city?: string | null;
  avatarUrl?: string | null;
  verified: boolean;
  createdAt: string;
}

export interface VendorProfile {
  id: string;
  userId: string;
  status: VendorStatus;
  shopName: string;
  shopSlug: string;
  shopDescription?: string | null;
  shopCategory?: string | null;
  shopLogoUrl?: string | null;
  vendorCode: string;
  country: string;
  city: string;
  address?: string | null;
  commerceRegister?: string | null;
  idDocumentUrl?: string | null;
  idDocumentType?: string | null;
}

export interface AuthUser extends Profile {
  vendor?: VendorProfile | null;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface RegisterData {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
  confirmPassword: string;
  city: string;
  acceptTerms: boolean;
}

export interface VendorRegisterData {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  idDocument: File | null;
  idDocumentType: 'cni' | 'passport';
  shopName: string;
  country: 'SN' | 'BF' | 'ML';
  city: string;
  address: string;
  shopCategory: string;
  shopDescription: string;
  shopLogo: File | null;
  commerceRegister?: string;
  acceptTerms: boolean;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  needsEmailConfirmation?: boolean;
  vendorCode?: string;
}
