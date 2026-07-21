import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[AfriZone] Variables Supabase manquantes. Créez un fichier .env.local avec VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(
  supabaseUrl ?? '',
  supabaseAnonKey ?? ''
);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
