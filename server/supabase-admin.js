import { createClient } from '@supabase/supabase-js';

let cached = null;

export function getAdminClient() {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants sur le VPS');
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function getUserClient(accessToken) {
  const url = process.env.SUPABASE_URL || '';
  const anon = process.env.SUPABASE_ANON_KEY || '';
  if (!url || !anon) {
    throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY manquants sur le VPS');
  }
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireUser(req) {
  const auth = req.header('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    const err = new Error('Non authentifié');
    err.status = 401;
    throw err;
  }
  const client = getUserClient(token);
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    const err = new Error('Session invalide');
    err.status = 401;
    throw err;
  }
  return { user: data.user, token, client };
}

export async function requireAdmin(req) {
  const { user, token, client } = await requireUser(req);
  const admin = getAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'admin') {
    const err = new Error('Accès admin requis');
    err.status = 403;
    throw err;
  }
  return { user, token, client, profile };
}
