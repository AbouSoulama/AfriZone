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
  if (lower.includes('password')) {
    return 'Mot de passe invalide (minimum 6 caractères).';
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Trop de tentatives. Réessayez dans quelques minutes.';
  }
  return message || 'Une erreur est survenue.';
}
