/**
 * Profils de documents d'identité AfriZone (SN, BF, ML, GN).
 * Scoring OCR basé sur en-têtes, champs, codes pays et MRZ.
 * Aucune donnée personnelle stockée.
 */

export type IdDocKind = 'cni' | 'passport';
export type IdCountryCode = 'SN' | 'BF' | 'ML' | 'GN';

export interface IdDocSignal {
  id: string;
  weight: number;
  pattern: RegExp;
}

export interface IdDocProfile {
  id: string;
  kind: IdDocKind;
  country: IdCountryCode;
  label: string;
  /** Score minimum pour validation automatique */
  minScore: number;
  /** Score minimum pour statut « uncertain » (revue admin) */
  softScore: number;
  signals: IdDocSignal[];
}

/** Normalise le texte OCR comme dans le scanner */
export function normalizeIdOcr(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[«»‹›]/g, '<')
    .replace(/[''`´]/g, "'")
    .replace(/[|¦]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Champs génériques CNI — deux-points optionnels (OCR téléphone souvent sans « : ») */
const CNI_FIELD_SIGNALS: IdDocSignal[] = [
  { id: 'field-nom', weight: 4, pattern: /\bnom\s*:?/i },
  { id: 'field-prenoms', weight: 5, pattern: /\bprenoms?\s*:?/i },
  { id: 'field-nee-le', weight: 10, pattern: /\bne\(?e\)?\s*le\s*:?/i },
  { id: 'field-sexe', weight: 3, pattern: /\bsexe\s*:?/i },
  { id: 'field-taille', weight: 10, pattern: /\btaille\s*:?/i },
  { id: 'field-profession', weight: 10, pattern: /\bprofession\s*:?/i },
  {
    id: 'field-delivree',
    weight: 8,
    pattern: /delivr[eé]e?\s*le|delivree?le|date\s+de\s+delivrance/i,
  },
  { id: 'field-expire', weight: 8, pattern: /expire\s*le|date\s+d'?expiration/i },
  { id: 'sig-titulaire', weight: 4, pattern: /signature\s+du\s+titulaire/i },
  { id: 'cedea', weight: 6, pattern: /\bcedea[ou]?\b|\becowas\b/i },
];

const PASSPORT_FIELD_SIGNALS: IdDocSignal[] = [
  { id: 'surname', weight: 6, pattern: /\bsurname\b|\bnom\b/i },
  { id: 'given-names', weight: 6, pattern: /given\s+names?|\bprenoms?\b/i },
  { id: 'nationalite', weight: 8, pattern: /nationalit/i },
  {
    id: 'date-naissance',
    weight: 6,
    pattern: /date\s+de\s+naissance|date\s+of\s+birth/i,
  },
  {
    id: 'lieu-naissance',
    weight: 6,
    pattern: /lieu\s+de\s+naissance|place\s+of\s+birth/i,
  },
  {
    id: 'date-expiration',
    weight: 6,
    pattern: /date\s+d'?expiration|date\s+of\s+expiry|expire/i,
  },
  {
    id: 'sig-bearer',
    weight: 4,
    pattern: /signature\s+of\s+bearer|signature\s+du\s+titulaire/i,
  },
  {
    id: 'country-code-label',
    weight: 8,
    pattern: /code\s+du\s+pays|country\s+code/i,
  },
];

/**
 * CNIB Burkina Faso (recto / verso observés).
 * minScore calibré pour photos smartphone (OCR imparfait).
 */
export const PROFILE_CNIB_BF: IdDocProfile = {
  id: 'cnib-bf',
  kind: 'cni',
  country: 'BF',
  label: 'CNIB Burkina Faso',
  minScore: 42,
  softScore: 26,
  signals: [
    {
      id: 'header-cnib-full',
      weight: 40,
      pattern: /carte\s+nationale\s+d'?identite\s+burkinab/i,
    },
    {
      id: 'header-carte-nationale',
      weight: 22,
      pattern: /carte\s+nationale\s+d'?identite/i,
    },
    { id: 'cnib-token', weight: 18, pattern: /\bcnib\b/i },
    { id: 'burkina-faso', weight: 18, pattern: /burkina\s*faso/i },
    { id: 'burkina-alone', weight: 6, pattern: /\bburkina\b/i },
    { id: 'burkinabe', weight: 10, pattern: /\bburkinab/i },
    {
      id: 'devise-bf',
      weight: 12,
      pattern: /unite.{0,12}progres.{0,12}justice/i,
    },
    ...CNI_FIELD_SIGNALS,
    {
      id: 'sig-autorite',
      weight: 5,
      pattern: /signature\s+de\s+l'?autorite/i,
    },
    { id: 'serial-b', weight: 14, pattern: /\bB\d{7,10}\b/ },
    { id: 'long-id', weight: 8, pattern: /\b\d{15,19}\b/ },
    { id: 'mrz-i-bfa', weight: 40, pattern: /i\s*<\s*bfa/i },
    { id: 'mrz-bfa-block', weight: 20, pattern: /i<bfa[a-z0-9<]{6,}/i },
    { id: 'verso-province', weight: 8, pattern: /\bprovince\b/i },
    { id: 'verso-residence', weight: 6, pattern: /\bresidence\b/i },
    {
      id: 'verso-prevenir',
      weight: 8,
      pattern: /personne\s+a\s+prevenir/i,
    },
  ],
};

export const PROFILE_PASSPORT_BF: IdDocProfile = {
  id: 'passport-bf',
  kind: 'passport',
  country: 'BF',
  label: 'Passeport Burkina Faso',
  minScore: 42,
  softScore: 26,
  signals: [
    { id: 'passeport', weight: 26, pattern: /\bpasseport\b/i },
    { id: 'passport-en', weight: 16, pattern: /\bpassport\b/i },
    { id: 'burkina-faso', weight: 18, pattern: /burkina\s*faso/i },
    { id: 'burkinabe', weight: 14, pattern: /\bburkinab/i },
    { id: 'code-bfa', weight: 16, pattern: /\bbfa\b/i },
    {
      id: 'type-p',
      weight: 8,
      pattern: /type\s*\/\s*type[\s\S]{0,40}\bP\b|\btype\s*[:/]?\s*P\b/i,
    },
    {
      id: 'passport-no-label',
      weight: 12,
      pattern: /n[°o]?\s*de\s+passeport|passport\s*no/i,
    },
    ...PASSPORT_FIELD_SIGNALS,
    {
      id: 'autorite-police',
      weight: 12,
      pattern: /police\s+nationale|direction\s+generale/i,
    },
    { id: 'mrz-ppbfa', weight: 40, pattern: /ppbfa[a-z<]/i },
    { id: 'mrz-p-bfa', weight: 35, pattern: /p\s*<\s*bfa/i },
    { id: 'mrz-pbfa', weight: 28, pattern: /(?:^|[^a-z])pbfa[a-z<]/i },
    { id: 'serial-a', weight: 10, pattern: /\bA\d{6,9}\b/ },
    {
      id: 'mrz-line2',
      weight: 14,
      pattern: /[A-Z0-9]{8,9}<\dBFA\d{6,}[MF]\d+/i,
    },
  ],
};

export const PROFILE_CNI_SN: IdDocProfile = {
  id: 'cni-sn',
  kind: 'cni',
  country: 'SN',
  label: 'CNI Sénégal',
  minScore: 38,
  softScore: 22,
  signals: [
    { id: 'senegal', weight: 20, pattern: /\bsenegal\b/i },
    {
      id: 'republique-senegal',
      weight: 22,
      pattern: /republique\s+du\s+senegal/i,
    },
    {
      id: 'header-carte-nationale',
      weight: 22,
      pattern: /carte\s+nationale\s+d'?identite/i,
    },
    { id: 'cni', weight: 10, pattern: /\bcni\b/i },
    { id: 'mrz-i-sen', weight: 36, pattern: /i\s*<\s*sen/i },
    { id: 'mrz-sen-block', weight: 18, pattern: /i<sen[a-z0-9<]{6,}/i },
    { id: 'code-sen', weight: 10, pattern: /\bsen\b/i },
    { id: 'senegalaise', weight: 10, pattern: /senegalais/i },
    ...CNI_FIELD_SIGNALS,
  ],
};

export const PROFILE_PASSPORT_SN: IdDocProfile = {
  id: 'passport-sn',
  kind: 'passport',
  country: 'SN',
  label: 'Passeport Sénégal',
  minScore: 38,
  softScore: 22,
  signals: [
    { id: 'passeport', weight: 24, pattern: /\bpasseport\b/i },
    { id: 'passport-en', weight: 14, pattern: /\bpassport\b/i },
    { id: 'senegal', weight: 20, pattern: /\bsenegal\b/i },
    {
      id: 'republique-senegal',
      weight: 18,
      pattern: /republique\s+du\s+senegal/i,
    },
    { id: 'mrz-ppsen', weight: 38, pattern: /ppsen[a-z<]/i },
    { id: 'mrz-p-sen', weight: 32, pattern: /p\s*<\s*sen/i },
    { id: 'code-sen', weight: 12, pattern: /\bsen\b/i },
    { id: 'senegalaise', weight: 10, pattern: /senegalais/i },
    {
      id: 'passport-no-label',
      weight: 10,
      pattern: /n[°o]?\s*de\s+passeport|passport\s*no/i,
    },
    ...PASSPORT_FIELD_SIGNALS,
  ],
};

export const PROFILE_CNI_ML: IdDocProfile = {
  id: 'cni-ml',
  kind: 'cni',
  country: 'ML',
  label: 'CNI Mali',
  minScore: 38,
  softScore: 22,
  signals: [
    {
      id: 'republique-mali',
      weight: 24,
      pattern: /republique\s+du\s+mali/i,
    },
    { id: 'mali', weight: 12, pattern: /\bmali\b/i },
    {
      id: 'header-carte-nationale',
      weight: 22,
      pattern: /carte\s+nationale\s+d'?identite/i,
    },
    { id: 'cni', weight: 10, pattern: /\bcni\b/i },
    { id: 'nni', weight: 12, pattern: /\bnni\b/i },
    { id: 'mrz-i-mli', weight: 36, pattern: /i\s*<\s*mli/i },
    { id: 'mrz-mli-block', weight: 18, pattern: /i<mli[a-z0-9<]{6,}/i },
    { id: 'code-mli', weight: 12, pattern: /\bmli\b/i },
    { id: 'malienne', weight: 10, pattern: /\bmalien/i },
    ...CNI_FIELD_SIGNALS,
  ],
};

export const PROFILE_PASSPORT_ML: IdDocProfile = {
  id: 'passport-ml',
  kind: 'passport',
  country: 'ML',
  label: 'Passeport Mali',
  minScore: 38,
  softScore: 22,
  signals: [
    { id: 'passeport', weight: 24, pattern: /\bpasseport\b/i },
    { id: 'passport-en', weight: 14, pattern: /\bpassport\b/i },
    {
      id: 'republique-mali',
      weight: 20,
      pattern: /republique\s+du\s+mali/i,
    },
    { id: 'mali', weight: 12, pattern: /\bmali\b/i },
    { id: 'mrz-ppmli', weight: 38, pattern: /ppmli[a-z<]/i },
    { id: 'mrz-p-mli', weight: 32, pattern: /p\s*<\s*mli/i },
    { id: 'code-mli', weight: 12, pattern: /\bmli\b/i },
    { id: 'malienne', weight: 10, pattern: /\bmalien/i },
    {
      id: 'passport-no-label',
      weight: 10,
      pattern: /n[°o]?\s*de\s+passeport|passport\s*no/i,
    },
    ...PASSPORT_FIELD_SIGNALS,
  ],
};

export const PROFILE_CNI_GN: IdDocProfile = {
  id: 'cni-gn',
  kind: 'cni',
  country: 'GN',
  label: 'CNI Guinée',
  minScore: 38,
  softScore: 22,
  signals: [
    { id: 'guinee', weight: 16, pattern: /\bguinee\b|\bguinea\b/i },
    {
      id: 'republique-guinee',
      weight: 24,
      pattern: /republique\s+de\s+guinee|republique\s+guineenne/i,
    },
    {
      id: 'header-carte-nationale',
      weight: 22,
      pattern: /carte\s+nationale\s+d'?identite/i,
    },
    { id: 'cni', weight: 10, pattern: /\bcni\b/i },
    { id: 'mrz-i-gin', weight: 36, pattern: /i\s*<\s*gin/i },
    { id: 'mrz-gin-block', weight: 18, pattern: /i<gin[a-z0-9<]{6,}/i },
    { id: 'code-gin', weight: 12, pattern: /\bgin\b/i },
    { id: 'guineenne', weight: 10, pattern: /guineenne|guinean/i },
    ...CNI_FIELD_SIGNALS,
  ],
};

export const PROFILE_PASSPORT_GN: IdDocProfile = {
  id: 'passport-gn',
  kind: 'passport',
  country: 'GN',
  label: 'Passeport Guinée',
  minScore: 38,
  softScore: 22,
  signals: [
    { id: 'passeport', weight: 24, pattern: /\bpasseport\b/i },
    { id: 'passport-en', weight: 14, pattern: /\bpassport\b/i },
    { id: 'guinee', weight: 14, pattern: /\bguinee\b|\bguinea\b/i },
    {
      id: 'republique-guinee',
      weight: 20,
      pattern: /republique\s+de\s+guinee|republique\s+guineenne/i,
    },
    { id: 'mrz-ppgin', weight: 38, pattern: /ppgin[a-z<]/i },
    { id: 'mrz-p-gin', weight: 32, pattern: /p\s*<\s*gin/i },
    { id: 'code-gin', weight: 12, pattern: /\bgin\b/i },
    { id: 'guineenne', weight: 10, pattern: /guineenne|guinean/i },
    {
      id: 'passport-no-label',
      weight: 10,
      pattern: /n[°o]?\s*de\s+passeport|passport\s*no/i,
    },
    ...PASSPORT_FIELD_SIGNALS,
  ],
};

export const ALL_ID_PROFILES: IdDocProfile[] = [
  PROFILE_CNIB_BF,
  PROFILE_PASSPORT_BF,
  PROFILE_CNI_SN,
  PROFILE_PASSPORT_SN,
  PROFILE_CNI_ML,
  PROFILE_PASSPORT_ML,
  PROFILE_CNI_GN,
  PROFILE_PASSPORT_GN,
];

/** Signaux génériques « pièce d'identité » (tous pays) — pour zone uncertain */
export const GENERIC_ID_SIGNALS: IdDocSignal[] = [
  {
    id: 'generic-carte',
    weight: 18,
    pattern: /carte\s+nationale\s+d'?identite|\bcnib\b|\bcni\b/i,
  },
  { id: 'generic-passeport', weight: 18, pattern: /\bpasseport\b|\bpassport\b/i },
  { id: 'generic-mrz-i', weight: 22, pattern: /i\s*<\s*(bfa|sen|mli|gin)/i },
  {
    id: 'generic-mrz-p',
    weight: 22,
    pattern: /p\s*<\s*(bfa|sen|mli|gin)|pp(bfa|sen|mli|gin)/i,
  },
  {
    id: 'generic-biodata',
    weight: 8,
    pattern: /nationalit|date\s+de\s+naissance|given\s+names|prenoms/i,
  },
];

export function scoreSignals(
  text: string,
  signals: IdDocSignal[]
): { score: number; matched: string[] } {
  const matched: string[] = [];
  let score = 0;
  for (const signal of signals) {
    if (signal.pattern.test(text)) {
      score += signal.weight;
      matched.push(signal.id);
    }
  }
  return { score, matched };
}

export function scoreProfile(
  text: string,
  profile: IdDocProfile
): { score: number; matched: string[] } {
  return scoreSignals(text, profile.signals);
}

export function bestProfilesFor(
  text: string,
  kind: IdDocKind
): Array<{ profile: IdDocProfile; score: number; matched: string[] }> {
  return ALL_ID_PROFILES.filter((p) => p.kind === kind)
    .map((profile) => {
      const { score, matched } = scoreProfile(text, profile);
      return { profile, score, matched };
    })
    .sort((a, b) => b.score - a.score);
}

/** Indique si un signal fort de type document a été trouvé */
export function hasStrongTypeSignal(
  kind: IdDocKind,
  matched: string[]
): boolean {
  if (kind === 'cni') {
    return matched.some((id) =>
      /header|cnib|carte|mrz-i|cni|nni/i.test(id)
    );
  }
  return matched.some((id) =>
    /passeport|passport|mrz-p|mrz-pp|passport-no|type-p/i.test(id)
  );
}
