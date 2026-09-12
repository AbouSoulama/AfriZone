import { supabase } from '../lib/supabase';

export async function fetchProfileAvatar(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('avatar_url, full_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.avatar_url as string) ?? null;
}

export async function fetchProfileName(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.full_name as string) ?? null;
}

/** Upload photo de profil livreur vers le bucket public `avatars`. */
export async function uploadDriverAvatar(
  userId: string,
  localUri: string,
  mimeType = 'image/jpeg'
): Promise<string> {
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const path = `${userId}/avatar/${Date.now()}.${ext}`;

  const response = await fetch(localUri);
  const blob = await response.blob();
  const arrayBuffer = await new Response(blob).arrayBuffer();

  const { error } = await supabase.storage.from('avatars').upload(path, arrayBuffer, {
    upsert: true,
    contentType: mimeType,
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
