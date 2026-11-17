/**
 * Lecture et contrôle de la zone MRZ des passeports (norme OACI 9303, TD3).
 *
 * Une MRZ réelle contient des chiffres de contrôle : un faux document tapé à la
 * main ne les respecte presque jamais. On les recalcule ici, en tolérant les
 * confusions classiques de l'OCR (O↔0, I↔1, S↔5, B↔8…).
 *
 * Aucune donnée personnelle n'est conservée : seuls les résultats des contrôles
 * (pays, validité des chiffres, date d'expiration) sont retournés.
 */

/** Pays acceptés par AfriZone (codes OACI à 3 lettres). */
export const AUTHORIZED_MRZ_COUNTRIES = ['BFA', 'SEN', 'MLI', 'GIN'] as const;
export type AuthorizedMrzCountry = (typeof AUTHORIZED_MRZ_COUNTRIES)[number];

export function isAuthorizedMrzCountry(code: string | null | undefined): boolean {
  return !!code && (AUTHORIZED_MRZ_COUNTRIES as readonly string[]).includes(code);
}

/** Confusions OCR dans un champ censé être numérique. */
const DIGIT_FIX: Record<string, string> = {
  O: '0',
  Q: '0',
  D: '0',
  I: '1',
  L: '1',
  Z: '2',
  S: '5',
  G: '6',
  B: '8',
};

function toDigits(raw: string): string {
  return raw
    .split('')
    .map((c) => (/\d/.test(c) ? c : (DIGIT_FIX[c] ?? c)))
    .join('');
}

const WEIGHTS = [7, 3, 1];

function charValue(c: string): number {
  if (c === '<') return 0;
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
  if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 55;
  return 0;
}

/** Chiffre de contrôle OACI (poids 7-3-1). */
export function mrzCheckDigit(field: string): number {
  let sum = 0;
  for (let i = 0; i < field.length; i++) {
    sum += charValue(field[i]) * WEIGHTS[i % 3];
  }
  return sum % 10;
}

export interface MrzPassportLine1 {
  /** Code pays émetteur (ex. BFA). */
  country: string;
}

export interface MrzPassportLine2 {
  nationality: string;
  sex: string;
  /** Nombre de contrôles réussis sur 3 (n° de document, naissance, expiration). */
  checksPassed: number;
  /** Date d'expiration lue (null si illisible). */
  expiry: Date | null;
  /** Le chiffre de contrôle de l'expiration est correct → la date est fiable. */
  expiryReliable: boolean;
  birthDate: Date | null;
}

/** MRZ de carte d'identité (TD1, 3 lignes de 30 caractères — verso de la CNIB). */
export interface MrzIdCard {
  country: string;
  /** Nombre de contrôles réussis (n° de document, naissance, expiration) sur 3. */
  checksPassed: number;
  expiry: Date | null;
  expiryReliable: boolean;
}

export interface MrzParseResult {
  line1: MrzPassportLine1 | null;
  line2: MrzPassportLine2 | null;
  /** Ligne MRZ de visa (V<) : ce n'est pas un passeport. */
  isVisa: boolean;
  /** Code pays si une MRZ de carte d'identité (I<XXX) est lue. */
  idCardCountry: string | null;
  /** Détail de la MRZ de carte d'identité (si les 2 lignes ont été lues). */
  idCard: MrzIdCard | null;
}

function parseYyMmDd(yymmdd: string, kind: 'birth' | 'expiry', now: Date): Date | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  const dd = Number(yymmdd.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  let year = 2000 + yy;
  if (kind === 'birth') {
    // Né après l'année courante → siècle précédent
    if (year > now.getFullYear()) year -= 100;
  }
  return new Date(Date.UTC(year, mm - 1, dd));
}

/** Candidats « ligne MRZ » : lignes OCR sans espaces contenant des « < ». */
function mrzCandidates(rawText: string): string[] {
  const out: string[] = [];
  for (const line of rawText.split(/\r?\n/)) {
    const compact = line.replace(/\s+/g, '').toUpperCase().replace(/[«‹]/g, '<');
    if (compact.includes('<') && compact.length >= 20) out.push(compact);
  }
  // Texte déjà aplati (une seule ligne) : on récupère les jetons contenant « < ».
  for (const token of rawText.toUpperCase().split(/\s+/)) {
    const t = token.replace(/[«‹]/g, '<');
    if (t.includes('<') && t.length >= 20 && !out.includes(t)) out.push(t);
  }
  return out;
}

const LINE1_RE = /P[A-Z<]([A-Z]{3})[A-Z]{2,}<</;
const LINE2_RE =
  /([A-Z0-9<]{9})([0-9A-Z<])([A-Z]{3})([0-9A-Z]{6})([0-9A-Z])([MF<])([0-9A-Z]{6})([0-9A-Z])/;
const VISA_RE = /^V[A-Z<][A-Z]{3}[A-Z]{2,}<</;
/** TD1 ligne 1 : I<PAYS + n° de document (9) + chiffre de contrôle. */
const TD1_L1_RE = /(?:^|[^A-Z])I[A-Z<](BFA|SEN|MLI|GIN)([A-Z0-9<]{9})([0-9A-Z<])/;
/** TD1 ligne 2 : naissance(6)+c, sexe, expiration(6)+c, nationalité(3). */
const TD1_L2_RE = /([0-9A-Z]{6})([0-9A-Z])([MF<])([0-9A-Z]{6})([0-9A-Z])(BFA|SEN|MLI|GIN)/;

export function parseMrz(rawText: string, now: Date = new Date()): MrzParseResult {
  const result: MrzParseResult = {
    line1: null,
    line2: null,
    isVisa: false,
    idCardCountry: null,
    idCard: null,
  };

  let td1L1: { country: string; docNumber: string; check: string } | null = null;
  let td1L2: {
    dob: string;
    dobCheck: string;
    exp: string;
    expCheck: string;
    nationality: string;
  } | null = null;

  for (const candidate of mrzCandidates(rawText)) {
    if (VISA_RE.test(candidate)) result.isVisa = true;

    const t1 = candidate.match(TD1_L1_RE);
    if (t1 && !td1L1) {
      td1L1 = { country: t1[1], docNumber: t1[2], check: t1[3] };
      if (!result.idCardCountry) result.idCardCountry = t1[1];
    }

    // Une ligne TD1 n°2 ne contient pas de n° de document : on ignore les lignes TD3
    if (!td1L2 && !LINE2_RE.test(candidate)) {
      const t2 = candidate.match(TD1_L2_RE);
      if (t2) {
        td1L2 = {
          dob: toDigits(t2[1]),
          dobCheck: toDigits(t2[2]),
          exp: toDigits(t2[4]),
          expCheck: toDigits(t2[5]),
          nationality: t2[6],
        };
      }
    }

    if (!result.line1) {
      const m1 = candidate.match(LINE1_RE);
      if (m1) result.line1 = { country: m1[1] };
    }

    if (!result.line2) {
      const m2 = candidate.match(LINE2_RE);
      if (m2) {
        const [, docNumber, docCheckRaw, nationality, dobRaw, dobCheckRaw, sex, expRaw, expCheckRaw] =
          m2;
        const dob = toDigits(dobRaw);
        const exp = toDigits(expRaw);
        const docCheck = toDigits(docCheckRaw);
        const dobCheck = toDigits(dobCheckRaw);
        const expCheck = toDigits(expCheckRaw);

        const okDoc = String(mrzCheckDigit(docNumber)) === docCheck;
        const okDob = /^\d{6}$/.test(dob) && String(mrzCheckDigit(dob)) === dobCheck;
        const okExp = /^\d{6}$/.test(exp) && String(mrzCheckDigit(exp)) === expCheck;

        result.line2 = {
          nationality,
          sex,
          checksPassed: [okDoc, okDob, okExp].filter(Boolean).length,
          expiry: parseYyMmDd(exp, 'expiry', now),
          expiryReliable: okExp,
          birthDate: parseYyMmDd(dob, 'birth', now),
        };
      }
    }
  }

  if (td1L1 || td1L2) {
    const country = td1L1?.country ?? td1L2?.nationality ?? '';
    const okDoc = td1L1
      ? String(mrzCheckDigit(td1L1.docNumber)) === toDigits(td1L1.check)
      : false;
    const okDob = td1L2
      ? /^\d{6}$/.test(td1L2.dob) && String(mrzCheckDigit(td1L2.dob)) === td1L2.dobCheck
      : false;
    const okExp = td1L2
      ? /^\d{6}$/.test(td1L2.exp) && String(mrzCheckDigit(td1L2.exp)) === td1L2.expCheck
      : false;
    result.idCardCountry = result.idCardCountry ?? country;
    result.idCard = {
      country,
      checksPassed: [okDoc, okDob, okExp].filter(Boolean).length,
      expiry: td1L2 ? parseYyMmDd(td1L2.exp, 'expiry', now) : null,
      expiryReliable: okExp,
    };
  }

  return result;
}

/** Fin de journée UTC de la date d'expiration (valable jusqu'au dernier jour inclus). */
export function isExpired(expiry: Date, now: Date = new Date()): boolean {
  const endOfDay = new Date(expiry.getTime() + 24 * 3600 * 1000 - 1);
  return now.getTime() > endOfDay.getTime();
}

/* ─────────────────────────────  Dates des CNI  ───────────────────────────── */

export interface CniDates {
  birth: Date | null;
  issue: Date | null;
  expiry: Date | null;
  /** Dates lues, cohérentes entre elles (naissance < délivrance < expiration, ~10 ans). */
  coherent: boolean;
}

function makeDate(dd: string, mm: string, yyyy: string): Date | null {
  const d = Number(dd);
  const m = Number(mm);
  const y = Number(yyyy);
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

const DATE_PART = String.raw`(\d{2})\s*[\/.\-]\s*(\d{2})\s*[\/.\-]\s*(\d{4})`;

function dateAfter(text: string, labelRe: string): Date | null {
  const re = new RegExp(`${labelRe}[^\\d]{0,8}${DATE_PART}`, 'i');
  const m = text.match(re);
  return m ? makeDate(m[1], m[2], m[3]) : null;
}

/** Lit « Né(e) le », « Délivrée le » et « Expire le » d'une CNI (texte OCR normalisé). */
export function extractCniDates(text: string): CniDates {
  const birth = dateAfter(text, String.raw`ne\(?e\)?\s*le\s*:?`);
  const issue = dateAfter(text, String.raw`delivr\w{0,3}\s*le\s*:?`);
  const expiry = dateAfter(text, String.raw`expire\s*le\s*:?`);

  const YEAR_MS = 365.25 * 24 * 3600 * 1000;
  let coherent = false;
  if (issue && expiry) {
    const validityYears = (expiry.getTime() - issue.getTime()) / YEAR_MS;
    coherent = validityYears >= 3 && validityYears <= 12;
    if (coherent && birth) coherent = birth.getTime() < issue.getTime();
  }
  return { birth, issue, expiry, coherent };
}
