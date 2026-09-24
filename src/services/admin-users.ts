import { supabase } from '../lib/supabase';
import type { UserRole } from '../types/auth';
import { countryCodeFromLabelOrCity } from '../types/catalog';

export interface AdminUserRow {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  city: string | null;
  /** Pays résolu (vendeur/livreur → entité ; sinon ville du profil). */
  country: string | null;
  verified: boolean;
  avatarUrl: string | null;
  createdAt: string;
}

function mapUser(row: Record<string, unknown>, country: string | null): AdminUserRow {
  return {
    id: row.id as string,
    fullName: (row.full_name as string) || 'Sans nom',
    email: (row.email as string) ?? null,
    phone: (row.phone as string) ?? null,
    role: row.role as UserRole,
    city: (row.city as string) ?? null,
    country,
    verified: Boolean(row.verified),
    avatarUrl: (row.avatar_url as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function fetchUsersForAdmin(
  role?: UserRole | 'all',
  country?: string | 'ALL'
): Promise<AdminUserRow[]> {
  let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (role && role !== 'all') query = query.eq('role', role);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const userIds = rows.map((r) => r.id as string);

  const vendorCountry = new Map<string, string>();
  const driverCountry = new Map<string, string>();

  if (userIds.length) {
    const [vendorsRes, driversRes] = await Promise.all([
      supabase.from('vendors').select('user_id, country').in('user_id', userIds),
      supabase.from('drivers').select('user_id, country').in('user_id', userIds),
    ]);
    for (const v of vendorsRes.data ?? []) {
      const code = String(v.country || '').toUpperCase();
      if (code) vendorCountry.set(v.user_id as string, code);
    }
    for (const d of driversRes.data ?? []) {
      const code = String(d.country || '').toUpperCase();
      if (code) driverCountry.set(d.user_id as string, code);
    }
  }

  const mapped = rows.map((r) => {
    const id = r.id as string;
    const roleValue = r.role as UserRole;
    let resolved: string | null = null;
    if (roleValue === 'vendeur') {
      resolved = vendorCountry.get(id) || countryCodeFromLabelOrCity(r.city as string | null);
    } else if (roleValue === 'livreur') {
      resolved = driverCountry.get(id) || countryCodeFromLabelOrCity(r.city as string | null);
    } else if (roleValue === 'admin') {
      resolved = countryCodeFromLabelOrCity(r.city as string | null);
    } else {
      resolved =
        countryCodeFromLabelOrCity(r.city as string | null) ||
        vendorCountry.get(id) ||
        driverCountry.get(id) ||
        null;
    }
    return mapUser(r as Record<string, unknown>, resolved);
  });

  if (!country || country === 'ALL') return mapped;

  // Les admins restent visibles dans chaque vue pays (compte plateforme).
  return mapped.filter((u) => u.role === 'admin' || u.country === country);
}

export async function updateUserAdmin(
  userId: string,
  patch: {
    fullName?: string;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    role?: UserRole;
    verified?: boolean;
  }
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.fullName !== undefined) payload.full_name = patch.fullName;
  if (patch.email !== undefined) payload.email = patch.email;
  if (patch.phone !== undefined) payload.phone = patch.phone;
  if (patch.city !== undefined) payload.city = patch.city;
  if (patch.role !== undefined) payload.role = patch.role;
  if (patch.verified !== undefined) payload.verified = patch.verified;

  const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
  if (error) throw new Error(error.message);
}

export async function setUserPasswordAdmin(userId: string, password: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_user_password', {
    p_user_id: userId,
    p_password: password,
  });
  if (error) throw new Error(error.message);
}

export async function deleteUserAdmin(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_auth_user', {
    p_user_id: userId,
  });
  if (error) {
    throw new Error(
      error.message.includes('function') || error.message.includes('schema cache')
        ? 'Suppression utilisateur indisponible : exécutez les migrations 011 puis 015_fix_admin_deletes.sql'
        : error.message
    );
  }
}

export const ROLE_LABELS: Record<UserRole, string> = {
  client: 'Client',
  vendeur: 'Vendeur',
  livreur: 'Livreur',
  admin: 'Admin',
};
