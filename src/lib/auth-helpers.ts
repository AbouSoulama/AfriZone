/** Normalise un numéro : garde + et chiffres */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim().replace(/[\s.-]/g, '');
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.slice(1).replace(/\D/g, '');
  }
  return trimmed.replace(/\D/g, '');
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Email Auth si le client n'en a pas fourni (identifiant stable basé sur le téléphone) */
export function authEmailFromPhone(phone: string): string {
  const digits = normalizePhone(phone).replace(/\D/g, '');
  return `${digits}@phone.afrizone.app`;
}

export function isSyntheticAuthEmail(email: string | null | undefined): boolean {
  return Boolean(email?.endsWith('@phone.afrizone.app'));
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
}

export function generateVendorCode(country: string, city: string): string {
  const cityCode = city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3)
    .padEnd(3, 'X');
  const seq = Math.floor(1000 + Math.random() * 9000);
  return `${country}-${cityCode}-${seq}`;
}

const ID_DOC_MAX_BYTES = 5 * 1024 * 1024;
const ID_DOC_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];

/** MIME de secours quand le navigateur n’envoie pas file.type (souvent PDF mobile). */
export function guessFileContentType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'pdf') return 'application/pdf';
  return 'application/octet-stream';
}

/** Valide la pièce d'identité (CNI / passeport) */
export function validateIdDocument(file: File | null): string | null {
  if (!file) return "Veuillez uploader votre pièce d'identité (CNI ou passeport).";
  if (file.size > ID_DOC_MAX_BYTES) return 'Le fichier ne doit pas dépasser 5 Mo.';
  const typeOk =
    ID_DOC_TYPES.includes(file.type) ||
    /\.(jpe?g|png|webp|pdf)$/i.test(file.name);
  if (!typeOk) return 'Format accepté : JPG, PNG, WEBP ou PDF.';
  return null;
}

/** Message lisible pour les erreurs Storage Supabase. */
export function mapStorageError(error: unknown): string {
  const raw =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: string }).message || '')
      : error instanceof Error
        ? error.message
        : '';
  const lower = raw.toLowerCase();
  if (lower.includes('bucket') && (lower.includes('not found') || lower.includes('does not exist'))) {
    return 'Le bucket Storage « vendor-documents » est introuvable sur ce projet Supabase.';
  }
  if (
    lower.includes('row-level security') ||
    lower.includes('violates') ||
    lower.includes('unauthorized') ||
    lower.includes('permission') ||
    lower.includes('not allowed') ||
    lower.includes('403')
  ) {
    return 'Accès Storage refusé (RLS). Vérifiez les policies du bucket « vendor-documents » ou exécutez la migration 032.';
  }
  if (lower.includes('mime') || lower.includes('content type') || lower.includes('invalid')) {
    return 'Format de fichier refusé par Storage. Utilisez JPG, PNG, WEBP ou PDF.';
  }
  if (lower.includes('payload') || lower.includes('too large') || lower.includes('maximum')) {
    return 'Fichier trop volumineux pour Storage (max 5 Mo côté AfriZone).';
  }
  if (lower.includes('jwt') || lower.includes('session') || lower.includes('auth')) {
    return 'Session expirée pendant l’upload. Réessayez l’inscription.';
  }
  return raw
    ? `Upload pièce d’identité impossible : ${raw}`
    : "Impossible d'uploader la pièce d'identité.";
}

export function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'Identifiant ou mot de passe incorrect.';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'Un compte existe déjà avec cet email ou ce téléphone.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Confirmez votre email avant de vous connecter (vérifiez votre boîte de réception).';
  }
  if (
    lower.includes('rate limit') ||
    lower.includes('too many') ||
    lower.includes('over_request_rate_limit') ||
    lower.includes('over_email_send_rate_limit')
  ) {
    return 'Limite Supabase atteinte (trop d’essais Auth). Attendez 2–5 minutes, utilisez un nouvel email, ou augmentez les plafonds dans Supabase → Authentication → Rate Limits. En dev : désactivez aussi « Confirm email ».';
  }
  if (lower.includes('password')) {
    return 'Mot de passe invalide (minimum 6 caractères).';
  }
  return message || 'Une erreur est survenue.';
}
