import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};
const supabaseUrl = String(
  (extra.supabaseUrl as string) || process.env.EXPO_PUBLIC_SUPABASE_URL || ''
).trim();
const supabaseAnonKey = String(
  (extra.supabaseAnonKey as string) || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
).trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl.startsWith('http') && supabaseAnonKey.length > 20
);

/**
 * createClient throws if URL/key are empty — that crashed the first EAS APK
 * because .env is not uploaded to the cloud build.
 */
const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJwbGFjZWhvbGRlciJ9.placeholder';

export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? supabaseUrl : PLACEHOLDER_URL,
  isSupabaseConfigured ? supabaseAnonKey : PLACEHOLDER_KEY,
  {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);
