import { supabase } from '../lib/supabase';
import type { UserRole } from '../types/auth';

export interface AdminUserRow {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  city: string | null;
  verified: boolean;
  avatarUrl: string | null;
  createdAt: string;
}

function mapUser(row: Record<string, unknown>): AdminUserRow {
  return {
    id: row.id as string,
    fullName: (row.full_name as string) || 'Sans nom',
    email: (row.email as string) ?? null,
    phone: (row.phone as string) ?? null,
    role: row.role as UserRole,
    city: (row.city as string) ?? null,
    verified: Boolean(row.verified),
    avatarUrl: (row.avatar_url as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function fetchUsersForAdmin(role?: UserRole | 'all'): Promise<AdminUserRow[]> {
  let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (role && role !== 'all') query = query.eq('role', role);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapUser(r as Record<string, unknown>));
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
