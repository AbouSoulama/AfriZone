export type UserRole = 'visiteur' | 'client' | 'vendeur' | 'admin' | 'livreur';
export type VendorStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  email?: string;
  phone: string;
  fullName: string;
  role: UserRole;
  city?: string;
  createdAt: Date;
  verified: boolean;
  password?: string;
}

export interface Client extends User {
  role: 'client';
}

export interface Vendor extends User {
  role: 'vendeur';
  status: VendorStatus;
  shopName: string;
  shopDescription?: string;
  shopCategory?: string;
  shopLogo?: string;
  vendorCode: string;
  country?: string;
  address?: string;
  idDocument?: string;
  commerceRegister?: string;
  approvedAt?: Date;
  approvedBy?: string;
}

// Extend for internal use with password
export interface VendorWithPassword extends Vendor {
  password: string;
}

export interface UserWithPassword extends User {
  password: string;
}

export interface Admin extends User {
  role: 'admin';
}

export interface DeliveryPerson extends User {
  role: 'livreur';
  vehicleType?: string;
  licenseNumber?: string;
}

export interface Session {
  user: User | Vendor | Admin | DeliveryPerson;
  token: string;
  expiresAt: Date;
}

export interface OTPRequest {
  phone: string;
  code: string;
  expiresAt: Date;
  verified: boolean;
  type: 'register' | 'login' | 'password-reset';
}

export interface AuthState {
  user: User | Vendor | Admin | DeliveryPerson | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
