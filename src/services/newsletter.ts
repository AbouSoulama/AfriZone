import { supabase } from '../lib/supabase';

export async function subscribeNewsletter(email: string, country?: string | null) {
  const { data, error } = await supabase.rpc('subscribe_newsletter', {
    p_email: email.trim(),
    p_country: country || null,
    p_source: 'footer',
  });
  if (error) throw new Error(error.message);
  return data as { ok: boolean; email: string };
}
