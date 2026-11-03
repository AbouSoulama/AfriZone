/**
 * Profils appris à partir de documents réels AfriZone
 * (CNIB Burkina Faso + passeport biométrique BF Version 2025).
 * Utilisés pour le scoring OCR — pas de données personnelles stockées.
 */

export type IdDocKind = 'cni' | 'passport';
export type IdCountryCode = 'SN' | 'BF' | 'ML' | 'GN';

export interface IdDocSignal {
  /** Identifiant technique */
  id: string;
  /** Poids dans le score (plus élevé = plus discriminant) */
  weight: number;
  pattern: RegExp;
}

export interface IdDocProfile {
  id: string;
  kind: IdDocKind;
  country: IdCountryCode;
  label: string;
  /** Score minimum pour valider ce profil */
  minScore: number;
  signals: IdDocSignal[];
}

/** Normalise le texte OCR comme dans le scanner */
export function normalizeIdOcr(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[«»]/g, '<')
    .replace(/['’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * CNIB Burkina Faso (recto observé) :
 * - En-tête « CARTE NATIONALE D'IDENTITE BURKINABE »
 * - « BURKINA FASO » + devise Unité / Progrès / Justice
 * - Champs Nom, Prénoms, Né(e) le, Sexe, Taille, Profession, Délivrée le, Expire le
 * - N° rouge type B17091884
 * - Verso MRZ : I&lt;BFA… (3 lignes)
 */
export const PROFILE_CNIB_BF: IdDocProfile = {
  id: 'cnib-bf',
  kind: 'cni',
  country: 'BF',
  label: 'CNIB Burkina Faso',
  minScore: 55,
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
    { id: 'burkina-faso', weight: 20, pattern: /burkina\s*faso/i },
    { id: 'burkina-alone', weight: 8, pattern: /\bburkina\b/i },
    {
      id: 'devise-bf',
      weight: 12,
      pattern: /unite.{0,8}progres.{0,8}justice/i,
    },
    // Champs typiques CNIB (poids modérés — présents aussi sur passeport)
    { id: 'field-nom', weight: 3, pattern: /\bnom\s*:/i },
    { id: 'field-prenoms', weight: 4, pattern: /\bprenoms?\s*:/i },
    { id: 'field-nee-le', weight: 12, pattern: /\bne\(?e\)?\s*le\s*:/i },
    { id: 'field-sexe', weight: 3, pattern: /\bsexe\s*:/i },
    { id: 'field-taille', weight: 14, pattern: /\btaille\s*:/i },
    { id: 'field-profession', weight: 14, pattern: /\bprofession\s*:/i },
    {
      id: 'field-delivree',
      weight: 10,
      // OCR réel parfois « Délivréele » sans espace
      pattern: /delivr[eé]e?\s*le|delivree?le/i,
    },
    { id: 'field-expire', weight: 10, pattern: /expire\s*le/i },
    {
      id: 'sig-titulaire',
      weight: 4,
      pattern: /signature\s+du\s+titulaire/i,
    },
    {
      id: 'sig-autorite',
      weight: 6,
      pattern: /signature\s+de\s+l'?autorite/i,
    },
    // N° CNIB rouge : B + 7–9 chiffres (ex. B17091884) — pas A… des passeports
    { id: 'serial-b', weight: 16, pattern: /\bB\d{7,10}\b/ },
    // Identifiant long centré (ex. 09010200121056627)
    { id: 'long-id', weight: 10, pattern: /\b\d{15,19}\b/ },
    // MRZ verso carte (I<BFA) — distinct du passeport (PPBFA)
    { id: 'mrz-i-bfa', weight: 40, pattern: /i\s*<\s*bfa/i },
    { id: 'mrz-bfa-block', weight: 22, pattern: /i<bfa[a-z0-9<]{8,}/i },
    { id: 'verso-province', weight: 10, pattern: /\bprovince\b/i },
    { id: 'verso-residence', weight: 8, pattern: /\bresidence\b/i },
    {
      id: 'verso-prevenir',
      weight: 10,
      pattern: /personne\s+a\s+prevenir/i,
    },
  ],
};

/**
 * Passeport biométrique Burkina Faso (page d’identité, OCR réel) :
 * - PASSEPORT / PASSPORT, BURKINA FASO
 * - Type P · Code BFA · N° passeport
 * - Nom/Surname, Prénoms/Given names, Nationalité BURKINABE
 * - MRZ : PPBFA… ou P&lt;BFA…
 */
export const PROFILE_PASSPORT_BF: IdDocProfile = {
  id: 'passport-bf',
  kind: 'passport',
  country: 'BF',
  label: 'Passeport Burkina Faso',
  minScore: 55,
  signals: [
    { id: 'passeport', weight: 28, pattern: /\bpasseport\b/i },
    { id: 'passport-en', weight: 18, pattern: /\bpassport\b/i },
    { id: 'burkina-faso', weight: 20, pattern: /burkina\s*faso/i },
    { id: 'burkinabe', weight: 16, pattern: /\bburkinab[eè]\b/i },
    { id: 'code-bfa', weight: 18, pattern: /\bbfa\b/i },
    {
      id: 'type-p',
      weight: 10,
      pattern: /type\s*\/\s*type[\s\S]{0,30}\bP\b/i,
    },
    {
      id: 'passport-no-label',
      weight: 14,
      pattern: /n[°o]?\s*de\s+passeport|passport\s*no/i,
    },
    {
      id: 'country-code-label',
      weight: 10,
      pattern: /code\s+du\s+pays|country\s+code/i,
    },
    { id: 'surname', weight: 8, pattern: /\bsurname\b/i },
    { id: 'given-names', weight: 8, pattern: /given\s+names?/i },
    { id: 'nationalite', weight: 10, pattern: /nationalit/i },
    {
      id: 'date-naissance',
      weight: 8,
      pattern: /date\s+de\s+naissance|date\s+of\s+birth/i,
    },
    {
      id: 'lieu-naissance',
      weight: 8,
      pattern: /lieu\s+de\s+naissance|place\s+of\s+birth/i,
    },
    {
      id: 'autorite-police',
      weight: 14,
      pattern: /police\s+nationale|direction\s+generale/i,
    },
    {
      id: 'date-expiration',
      weight: 8,
      pattern: /date\s+d'?expiration|date\s+of\s+expiry/i,
    },
    // MRZ passeport BF observé : PPBFA… (pas toujours P<)
    { id: 'mrz-ppbfa', weight: 40, pattern: /ppbfa[a-z<]/i },
    { id: 'mrz-p-bfa', weight: 35, pattern: /p\s*<\s*bfa/i },
    { id: 'mrz-pbfa', weight: 30, pattern: /(?:^|[^a-z])pbfa[a-z<]/i },
    // N° passeport type A5120884
    { id: 'serial-a', weight: 12, pattern: /\bA\d{6,9}\b/ },
    {
      id: 'mrz-line2',
      weight: 16,
      pattern: /[A-Z0-9]{8,9}<\dBFA\d{6,}[MF]\d+/i,
    },
    {
      id: 'sig-bearer',
      weight: 6,
      pattern: /signature\s+of\s+bearer|signature\s+du\s+titulaire/i,
    },
  ],
};

/** Profils génériques SN / ML / GN (structure CEDEAO, à enrichir avec exemples) */
export const PROFILE_CNI_SN: IdDocProfile = {
  id: 'cni-sn',
  kind: 'cni',
  country: 'SN',
  label: 'CNI Sénégal',
  minScore: 50,
  signals: [
    { id: 'senegal', weight: 22, pattern: /\bsenegal\b/i },
    {
      id: 'carte-nationale',
      weight: 24,
      pattern: /carte\s+nationale\s+d'?identite/i,
    },
    { id: 'cni', weight: 12, pattern: /\bcni\b/i },
    { id: 'mrz-sen', weight: 30, pattern: /i\s*<\s*sen/i },
    { id: 'cedea', weight: 8, pattern: /\bcedea/i },
    { id: 'nom', weight: 5, pattern: /\bnom\b/i },
    { id: 'prenoms', weight: 6, pattern: /\bprenoms?\b/i },
  ],
};

export const PROFILE_PASSPORT_SN: IdDocProfile = {
  id: 'passport-sn',
  kind: 'passport',
  country: 'SN',
  label: 'Passeport Sénégal',
  minScore: 50,
  signals: [
    { id: 'passeport', weight: 24, pattern: /\bpasseport\b/i },
    { id: 'passport', weight: 14, pattern: /\bpassport\b/i },
    { id: 'senegal', weight: 22, pattern: /\bsenegal\b/i },
    { id: 'mrz-ppsen', weight: 35, pattern: /ppsen[a-z<]/i },
    { id: 'mrz-psen', weight: 30, pattern: /p\s*<\s*sen/i },
    { id: 'code-sen', weight: 12, pattern: /\bsen\b/i },
  ],
};

export const PROFILE_CNI_ML: IdDocProfile = {
  id: 'cni-ml',
  kind: 'cni',
  country: 'ML',
  label: 'CNI Mali',
  minScore: 50,
  signals: [
    { id: 'republique-mali', weight: 24, pattern: /republique\s+du\s+mali/i },
    { id: 'mali', weight: 12, pattern: /\bmali\b/i },
    {
      id: 'carte-nationale',
      weight: 24,
      pattern: /carte\s+nationale\s+d'?identite/i,
    },
    { id: 'mrz-mli', weight: 30, pattern: /i\s*<\s*mli/i },
  ],
};

export const PROFILE_PASSPORT_ML: IdDocProfile = {
  id: 'passport-ml',
  kind: 'passport',
  country: 'ML',
  label: 'Passeport Mali',
  minScore: 50,
  signals: [
    { id: 'passeport', weight: 24, pattern: /\bpasseport\b/i },
    { id: 'mali', weight: 16, pattern: /\bmali\b/i },
    { id: 'mrz-ppmli', weight: 35, pattern: /ppmli[a-z<]/i },
    { id: 'mrz-pmli', weight: 30, pattern: /p\s*<\s*mli/i },
  ],
};

export const PROFILE_CNI_GN: IdDocProfile = {
  id: 'cni-gn',
  kind: 'cni',
  country: 'GN',
  label: 'CNI Guinée',
  minScore: 50,
  signals: [
    { id: 'guinee', weight: 18, pattern: /\bguinee\b|\bguinea\b/i },
    {
      id: 'republique-guinee',
      weight: 22,
      pattern: /republique\s+de\s+guinee/i,
    },
    {
      id: 'carte-nationale',
      weight: 24,
      pattern: /carte\s+nationale\s+d'?identite/i,
    },
    { id: 'mrz-gin', weight: 30, pattern: /i\s*<\s*gin/i },
  ],
};

export const PROFILE_PASSPORT_GN: IdDocProfile = {
  id: 'passport-gn',
  kind: 'passport',
  country: 'GN',
  label: 'Passeport Guinée',
  minScore: 50,
  signals: [
    { id: 'passeport', weight: 24, pattern: /\bpasseport\b/i },
    { id: 'guinee', weight: 16, pattern: /\bguinee\b|\bguinea\b/i },
    { id: 'mrz-ppgin', weight: 35, pattern: /ppgin[a-z<]/i },
    { id: 'mrz-pgin', weight: 30, pattern: /p\s*<\s*gin/i },
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

export function scoreProfile(
  text: string,
  profile: IdDocProfile
): { score: number; matched: string[] } {
  const matched: string[] = [];
  let score = 0;
  for (const signal of profile.signals) {
    if (signal.pattern.test(text)) {
      score += signal.weight;
      matched.push(signal.id);
    }
  }
  return { score, matched };
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
