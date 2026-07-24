import { supabase } from '../lib/supabase';

export interface AddressInput {
  label?: string;
  fullName: string;
  phone: string;
  country: string;
  city: string;
  address: string;
  isDefault?: boolean;
}

export interface AddressView {
  id: string;
  userId: string;
  label: string | null;
  fullName: string;
  phone: string;
  country: string;
  city: string;
  address: string;
  isDefault: boolean;
  createdAt: string;
}

export interface ProfileUpdateInput {
  fullName: string;
  phone: string;
  city: string;
  email?: string | null;
}

export const ADDRESS_COUNTRIES = [
  { code: 'SN', label: 'Sénégal' },
  { code: 'BF', label: 'Burkina Faso' },
  { code: 'ML', label: 'Mali' },
] as const;

function mapAddress(row: Record<string, unknown>): AddressView {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    label: (row.label as string) ?? null,
    fullName: row.full_name as string,
    phone: row.phone as string,
    country: row.country as string,
    city: row.city as string,
    address: row.address as string,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at as string,
  };
}

export async function updateMyProfile(
  userId: string,
  input: ProfileUpdateInput
): Promise<void> {
  if (!input.fullName.trim()) throw new Error('Le nom est obligatoire.');
  if (!input.phone.trim()) throw new Error('Le téléphone est obligatoire.');
  if (!input.city.trim()) throw new Error('La ville est obligatoire.');

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: input.fullName.trim(),
      phone: input.phone.trim(),
      city: input.city.trim(),
      email: input.email?.trim() || null,
    })
    .eq('id', userId);

  if (error) {
    if (error.message.includes('profiles_phone') || error.code === '23505') {
      throw new Error('Ce numéro de téléphone est déjà utilisé.');
    }
    throw new Error(error.message);
  }
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Le fichier doit être une image.');
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('Avatar trop volumineux (max 2 Mo).');
  }

  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/avatar/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  const avatarUrl = data.publicUrl;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId);

  if (updateError) throw new Error(updateError.message);
  return avatarUrl;
}

export async function fetchMyAddresses(userId: string): Promise<AddressView[]> {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapAddress(row));
}

export async function fetchDefaultAddress(userId: string): Promise<AddressView | null> {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) return mapAddress(data);

  const { data: first, error: err2 } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (err2) throw new Error(err2.message);
  return first ? mapAddress(first) : null;
}

export async function createAddress(
  userId: string,
  input: AddressInput
): Promise<AddressView> {
  if (!input.fullName.trim() || !input.phone.trim() || !input.address.trim() || !input.city.trim()) {
    throw new Error('Nom, téléphone, adresse et ville sont obligatoires.');
  }

  const { count } = await supabase
    .from('addresses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  const isDefault = input.isDefault ?? (count ?? 0) === 0;

  const { data, error } = await supabase
    .from('addresses')
    .insert({
      user_id: userId,
      label: input.label?.trim() || null,
      full_name: input.fullName.trim(),
      phone: input.phone.trim(),
      country: input.country || 'SN',
      city: input.city.trim(),
      address: input.address.trim(),
      is_default: isDefault,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapAddress(data);
}

export async function updateAddress(
  userId: string,
  addressId: string,
  input: AddressInput
): Promise<AddressView> {
  if (!input.fullName.trim() || !input.phone.trim() || !input.address.trim() || !input.city.trim()) {
    throw new Error('Nom, téléphone, adresse et ville sont obligatoires.');
  }

  const { data, error } = await supabase
    .from('addresses')
    .update({
      label: input.label?.trim() || null,
      full_name: input.fullName.trim(),
      phone: input.phone.trim(),
      country: input.country || 'SN',
      city: input.city.trim(),
      address: input.address.trim(),
      is_default: input.isDefault ?? false,
    })
    .eq('id', addressId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapAddress(data);
}

export async function deleteAddress(userId: string, addressId: string): Promise<void> {
  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', addressId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

export async function setDefaultAddress(userId: string, addressId: string): Promise<void> {
  const { error } = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', addressId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}
