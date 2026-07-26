import { supabase } from '../lib/supabase';
import type { CatalogVendor } from '../types/catalog';
import type { VendorStatus } from '../types/auth';

export interface AdminVendorRow extends CatalogVendor {
  userId: string;
  address: string | null;
  idDocumentUrl: string | null;
  idDocumentType: string | null;
  commerceRegister: string | null;
  rejectionReason: string | null;
  createdAt: string;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  isGoldSeller?: boolean;
  isTopRated?: boolean;
}

function mapVendor(row: Record<string, unknown>): AdminVendorRow {
  const profile = row.profiles as Record<string, unknown> | null | undefined;
  return {
    id: row.id as string,
    userId: row.user_id as string,
    shopName: row.shop_name as string,
    shopSlug: row.shop_slug as string,
    shopDescription: (row.shop_description as string) ?? null,
    shopCategory: (row.shop_category as string) ?? null,
    shopLogoUrl: (row.shop_logo_url as string) ?? null,
    vendorCode: row.vendor_code as string,
    country: row.country as string,
    city: row.city as string,
    rating: Number(row.rating ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    totalSales: Number(row.total_sales ?? 0),
    status: row.status as string,
    isGoldSeller: Boolean(row.is_gold_seller),
    isTopRated: Boolean(row.is_top_rated),
    address: (row.address as string) ?? null,
    idDocumentUrl: (row.id_document_url as string) ?? null,
    idDocumentType: (row.id_document_type as string) ?? null,
    commerceRegister: (row.commerce_register as string) ?? null,
    rejectionReason: (row.rejection_reason as string) ?? null,
    createdAt: row.created_at as string,
    ownerName: (profile?.full_name as string) ?? null,
    ownerPhone: (profile?.phone as string) ?? null,
    ownerEmail: (profile?.email as string) ?? null,
  };
}

export async function fetchVendorsForAdmin(
  status?: VendorStatus | 'all'
): Promise<AdminVendorRow[]> {
  let query = supabase.from('vendors').select('*').order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const userIds = rows.map((r) => r.user_id as string).filter(Boolean);

  let profilesById: Record<string, { full_name?: string; phone?: string; email?: string }> = {};
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, phone, email')
      .in('id', userIds);
    profilesById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  }

  return rows
    .map((row) => {
      const profile = profilesById[row.user_id as string];
      return mapVendor({
        ...row,
        profiles: profile
          ? {
              full_name: profile.full_name,
              phone: profile.phone,
              email: profile.email,
            }
          : null,
      });
    })
    .sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

export async function updateVendorStatus(
  vendorId: string,
  status: VendorStatus,
  adminId: string,
  rejectionReason?: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    status,
    rejection_reason: rejectionReason || null,
  };

  if (status === 'approved') {
    payload.approved_at = new Date().toISOString();
    payload.approved_by = adminId;
  } else {
    payload.approved_at = null;
    payload.approved_by = null;
  }

  const { error } = await supabase.from('vendors').update(payload).eq('id', vendorId);
  if (error) throw new Error(error.message);
}

export async function updateVendorAdmin(
  vendorId: string,
  patch: Partial<{
    shopName: string;
    shopDescription: string | null;
    shopCategory: string | null;
    city: string;
    country: string;
    address: string | null;
    isGoldSeller: boolean;
    isTopRated: boolean;
  }>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.shopName !== undefined) payload.shop_name = patch.shopName;
  if (patch.shopDescription !== undefined) payload.shop_description = patch.shopDescription;
  if (patch.shopCategory !== undefined) payload.shop_category = patch.shopCategory;
  if (patch.city !== undefined) payload.city = patch.city;
  if (patch.country !== undefined) payload.country = patch.country;
  if (patch.address !== undefined) payload.address = patch.address;
  if (patch.isGoldSeller !== undefined) payload.is_gold_seller = patch.isGoldSeller;
  if (patch.isTopRated !== undefined) payload.is_top_rated = patch.isTopRated;

  const { error } = await supabase.from('vendors').update(payload).eq('id', vendorId);
  if (error) throw new Error(error.message);
}

export async function deleteVendorAdmin(vendorId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_vendor', {
    p_vendor_id: vendorId,
  });
  if (error) {
    throw new Error(
      error.message.includes('function') || error.message.includes('schema cache')
        ? 'Suppression vendeur indisponible : exécutez la migration 015_fix_admin_deletes.sql'
        : error.message
    );
  }
}

export async function getVendorDocumentUrl(path: string): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const { data, error } = await supabase.storage
    .from('vendor-documents')
    .createSignedUrl(path, 60 * 30);
  if (error) {
    console.error(error);
    return null;
  }
  return data.signedUrl;
}
