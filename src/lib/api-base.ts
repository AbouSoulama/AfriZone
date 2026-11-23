/** Base URL de l’API Node Hostinger (sans slash final). */
export function apiBase(): string {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const app = (import.meta.env.VITE_APP_URL as string | undefined)?.trim();
  if (app && !app.includes('localhost')) {
    return `${app.replace(/\/$/, '')}/api`;
  }
  return 'https://afrizones.com/api';
}
