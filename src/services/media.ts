import { apiBase } from '../lib/api-base';
import { supabase } from '../lib/supabase';

export type MediaBucket =
  | 'product-images'
  | 'avatars'
  | 'vendor-documents'
  | 'delivery-proofs';

const PUBLIC_BUCKETS = new Set<MediaBucket>(['product-images', 'avatars']);

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Connectez-vous pour envoyer un fichier.');
  return { Authorization: `Bearer ${token}` };
}

export async function uploadMediaFile(opts: {
  bucket: MediaBucket;
  file: File;
  folder: string;
  userId: string;
}): Promise<{ path: string; url: string | null }> {
  const headers = await authHeader();
  const form = new FormData();
  form.append('file', opts.file);
  form.append('bucket', opts.bucket);
  form.append('folder', opts.folder);
  form.append('userId', opts.userId);

  const res = await fetch(`${apiBase()}/media/upload`, {
    method: 'POST',
    headers,
    body: form,
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    path?: string;
    url?: string | null;
    error?: string;
  };
  if (!res.ok || !body.ok || !body.path) {
    throw new Error(body.error || `Upload impossible (${res.status})`);
  }
  return { path: body.path, url: body.url ?? null };
}

export async function getPrivateMediaUrl(
  bucket: MediaBucket,
  path: string,
  expiresSec = 1800
): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  // Ancien fichier encore sur Supabase Storage
  if (!path.includes('/') || path.startsWith('http')) {
    /* continue */
  }
  try {
    const headers = await authHeader();
    const res = await fetch(`${apiBase()}/media/sign`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket, path, expiresSec }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      url?: string;
      error?: string;
    };
    if (res.ok && body.ok && body.url) return body.url;

    // Repli Supabase pour fichiers historiques
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresSec);
    if (!error && data?.signedUrl) return data.signedUrl;
    return null;
  } catch {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresSec);
    return data?.signedUrl || null;
  }
}

export function isPublicBucket(bucket: MediaBucket): boolean {
  return PUBLIC_BUCKETS.has(bucket);
}
