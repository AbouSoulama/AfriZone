/** Vérifie que les profils scorrent correctement sur l'OCR réel des exemples. */

const CNIB_OCR = `CARTE NATIONALE D'IDENTITE BURKINABE | | BURKINA |
09010200121056627 CE5 |
Nom: SOULAMA
Prénoms: MINON ABOUBACAR
Né(e) le: 21/02/1998 A BOBO-DIOULASSO
Sexe: M Taille: 178 cm
Profession: ETUDIANT
= Délivréele: 06/05/2022
Expire le: 05/05/2032 B17091884
Signature du titulaire Signature de l'autorité`;

const CNIB_MRZ_OCR = `CARTE NATIONALE D'IDENTITE BURKINABE
I<BFAB110977211<<<<<<<<<<<<<<<
9611216M2904238BFA<<<<<<<<<<<8
SILGA<<ARISTIDE<<<<<<<<<<<<<<<`;

const PASSPORT_OCR = `BURKINA FASO
PASSEPORT _ Type / Type Code du pays / Country code N° de passeport / Passport Ne.
P BFA AS120884
Nom / Sumame
OUEDRAOGO
Prénoms / Given names
MARTIAL ELYSEE PENGDEWENDE
Nationalité / Nationality
BURKINABE
Date de naissance / Date of birth
30 JUIN/JUN 2007 BOBO-DIOULASSO
Sexe / Sex
M OUAGADOUGOU BFA
Date de délivrance
04 JUIN/JUN 2026 DIRECTION GENERALE
Date d'expiration DELA POLICE NATIONALE
03 JUIN/JUN 2031
PPBFAOUEDRAOGO<<MARTIAL<ELYSEE<PENGDEWENDE<<
A5120884<6BFA0706302M3106039<<<<<<<<<<<<<<06
Signature du titulaire`;

function normalize(raw) {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[«»]/g, '<')
    .replace(/['’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Inline minimal copies of patterns for node without TS
const { createRequire } = await import('module');
// Dynamic import of compiled? We can't easily import TS. Duplicate score logic briefly:

const profiles = [
  {
    id: 'cnib-bf',
    kind: 'cni',
    minScore: 55,
    signals: [
      [/carte\s+nationale\s+d'?identite\s+burkinab/i, 40],
      [/carte\s+nationale\s+d'?identite/i, 22],
      [/\bcnib\b/i, 18],
      [/burkina\s*faso/i, 20],
      [/\bburkina\b/i, 8],
      [/\bnom\b/i, 6],
      [/\bprenoms?\b/i, 8],
      [/\bne\(?e\)?\s*le\b/i, 10],
      [/\bsexe\b/i, 5],
      [/\btaille\b/i, 10],
      [/\bprofession\b/i, 10],
      [/\bdelivr[eé]e?\s*le\b/i, 8],
      [/\bexpire\s*le\b/i, 8],
      [/signature\s+du\s+titulaire/i, 8],
      [/\bB\d{7,10}\b/, 14],
      [/\b\d{15,19}\b/, 8],
      [/i\s*<\s*bfa/i, 35],
      [/i<bfa[a-z0-9<]{8,}/i, 18],
      [/[A-Z]{2,}<<[A-Z]{2,}/, 10],
    ],
  },
  {
    id: 'passport-bf',
    kind: 'passport',
    minScore: 55,
    signals: [
      [/\bpasseport\b/i, 28],
      [/\bpassport\b/i, 18],
      [/burkina\s*faso/i, 20],
      [/\bburkinab[eè]\b/i, 16],
      [/\bbfa\b/i, 18],
      [/n[°o]?\s*de\s+passeport|passport\s*no/i, 14],
      [/code\s+du\s+pays|country\s+code/i, 10],
      [/nationalit/i, 10],
      [/police\s+nationale|direction\s+generale/i, 14],
      [/ppbfa[a-z<]/i, 40],
      [/p\s*<\s*bfa/i, 35],
      [/\bA\d{6,9}\b/, 12],
      [/[A-Z0-9]{8,9}<\dBFA\d{6,}[MF]\d+/i, 16],
    ],
  },
];

function score(text, profile) {
  const t = normalize(text);
  let s = 0;
  const matched = [];
  for (const [re, w] of profile.signals) {
    if (re.test(t)) {
      s += w;
      matched.push(String(re));
    }
  }
  return { s, matched: matched.length };
}

for (const [name, text, expectKind] of [
  ['CNIB recto', CNIB_OCR, 'cni'],
  ['CNIB MRZ', CNIB_MRZ_OCR, 'cni'],
  ['Passport biodata', PASSPORT_OCR, 'passport'],
]) {
  console.log('\n==', name, 'expect', expectKind);
  for (const p of profiles) {
    const { s, matched } = score(text, p);
    console.log(
      p.id,
      'score=',
      s,
      'matched=',
      matched,
      s >= p.minScore ? 'PASS' : 'fail',
      p.kind === expectKind ? '(expected kind)' : '(opposite)'
    );
  }
}
