/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_PAYMENT_MODE?: string;
  readonly VITE_FEDAPAY_ENV?: string;
  readonly VITE_APP_URL?: string;
  readonly VITE_ASSISTANT_MODE?: string;
  readonly VITE_DRIVER_APK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
