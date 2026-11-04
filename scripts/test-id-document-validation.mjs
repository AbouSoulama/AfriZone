/**
 * Tests du moteur de validation ID (profils + décision OCR).
 * Exécute : node scripts/test-id-document-validation.mjs
 * Option OCR images : node scripts/test-id-document-validation.mjs --ocr
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const WITH_OCR = process.argv.includes('--ocr');

// --- Copie fidèle de normalize + scoring (alignée sur id-doc-profiles.ts) ---

function normalizeIdOcr(raw) {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[«»‹›]/g, '<')
    .replace(/[''`´]/g, "'")
    .replace(/[|¦]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function S(id, weight, pattern) {
  return { id, weight, pattern };
}

const CNI_FIELD_SIGNALS = [
  S('field-nom', 4, /\bnom\s*:?/i),
  S('field-prenoms', 5, /\bprenoms?\s*:?/i),
  S('field-nee-le', 10, /\bne\(?e\)?\s*le\s*:?/i),
  S('field-sexe', 3, /\bsexe\s*:?/i),
  S('field-taille', 10, /\btaille\s*:?/i),
  S('field-profession', 10, /\bprofession\s*:?/i),
  S('field-delivree', 8, /delivr[eé]e?\s*le|delivree?le|date\s+de\s+delivrance/i),
  S('field-expire', 8, /expire\s*le|date\s+d'?expiration/i),
  S('sig-titulaire', 4, /signature\s+du\s+titulaire/i),
  S('cedea', 6, /\bcedea[ou]?\b|\becowas\b/i),
];

const PASSPORT_FIELD_SIGNALS = [
  S('surname', 6, /\bsurname\b|\bnom\b/i),
  S('given-names', 6, /given\s+names?|\bprenoms?\b/i),
  S('nationalite', 8, /nationalit/i),
  S('date-naissance', 6, /date\s+de\s+naissance|date\s+of\s+birth/i),
  S('lieu-naissance', 6, /lieu\s+de\s+naissance|place\s+of\s+birth/i),
  S('date-expiration', 6, /date\s+d'?expiration|date\s+of\s+expiry|expire/i),
  S('sig-bearer', 4, /signature\s+of\s+bearer|signature\s+du\s+titulaire/i),
  S('country-code-label', 8, /code\s+du\s+pays|country\s+code/i),
];

const ALL = [
  {
    id: 'cnib-bf',
    kind: 'cni',
    country: 'BF',
    label: 'CNIB Burkina Faso',
    minScore: 42,
    softScore: 26,
    signals: [
      S('header-cnib-full', 40, /carte\s+nationale\s+d'?identite\s+burkinab/i),
      S('header-carte-nationale', 22, /carte\s+nationale\s+d'?identite/i),
      S('cnib-token', 18, /\bcnib\b/i),
      S('burkina-faso', 18, /burkina\s*faso/i),
      S('burkina-alone', 6, /\bburkina\b/i),
      S('burkinabe', 10, /\bburkinab/i),
      S('devise-bf', 12, /unite.{0,12}progres.{0,12}justice/i),
      ...CNI_FIELD_SIGNALS,
      S('sig-autorite', 5, /signature\s+de\s+l'?autorite/i),
      S('serial-b', 14, /\bB\d{7,10}\b/),
      S('long-id', 8, /\b\d{15,19}\b/),
      S('mrz-i-bfa', 40, /i\s*<\s*bfa/i),
      S('mrz-bfa-block', 20, /i<bfa[a-z0-9<]{6,}/i),
    ],
  },
  {
    id: 'passport-bf',
    kind: 'passport',
    country: 'BF',
    label: 'Passeport Burkina Faso',
    minScore: 42,
    softScore: 26,
    signals: [
      S('passeport', 26, /\bpasseport\b/i),
      S('passport-en', 16, /\bpassport\b/i),
      S('burkina-faso', 18, /burkina\s*faso/i),
      S('burkinabe', 14, /\bburkinab/i),
      S('code-bfa', 16, /\bbfa\b/i),
      S('type-p', 8, /type\s*\/\s*type[\s\S]{0,40}\bP\b|\btype\s*[:/]?\s*P\b/i),
      S('passport-no-label', 12, /n[°o]?\s*de\s+passeport|passport\s*no/i),
      ...PASSPORT_FIELD_SIGNALS,
      S('autorite-police', 12, /police\s+nationale|direction\s+generale/i),
      S('mrz-ppbfa', 40, /ppbfa[a-z<]/i),
      S('mrz-p-bfa', 35, /p\s*<\s*bfa/i),
      S('serial-a', 10, /\bA\d{6,9}\b/),
    ],
  },
  {
    id: 'cni-sn',
    kind: 'cni',
    country: 'SN',
    label: 'CNI Sénégal',
    minScore: 38,
    softScore: 22,
    signals: [
      S('senegal', 20, /\bsenegal\b/i),
      S('republique-senegal', 22, /republique\s+du\s+senegal/i),
      S('header-carte-nationale', 22, /carte\s+nationale\s+d'?identite/i),
      S('cni', 10, /\bcni\b/i),
      S('mrz-i-sen', 36, /i\s*<\s*sen/i),
      S('code-sen', 10, /\bsen\b/i),
      ...CNI_FIELD_SIGNALS,
    ],
  },
  {
    id: 'passport-sn',
    kind: 'passport',
    country: 'SN',
    label: 'Passeport Sénégal',
    minScore: 38,
    softScore: 22,
    signals: [
      S('passeport', 24, /\bpasseport\b/i),
      S('passport-en', 14, /\bpassport\b/i),
      S('senegal', 20, /\bsenegal\b/i),
      S('mrz-ppsen', 38, /ppsen[a-z<]/i),
      S('mrz-p-sen', 32, /p\s*<\s*sen/i),
      S('code-sen', 12, /\bsen\b/i),
      ...PASSPORT_FIELD_SIGNALS,
    ],
  },
  {
    id: 'cni-ml',
    kind: 'cni',
    country: 'ML',
    label: 'CNI Mali',
    minScore: 38,
    softScore: 22,
    signals: [
      S('republique-mali', 24, /republique\s+du\s+mali/i),
      S('mali', 12, /\bmali\b/i),
      S('header-carte-nationale', 22, /carte\s+nationale\s+d'?identite/i),
      S('cni', 10, /\bcni\b/i),
      S('mrz-i-mli', 36, /i\s*<\s*mli/i),
      S('code-mli', 12, /\bmli\b/i),
      ...CNI_FIELD_SIGNALS,
    ],
  },
  {
    id: 'passport-ml',
    kind: 'passport',
    country: 'ML',
    label: 'Passeport Mali',
    minScore: 38,
    softScore: 22,
    signals: [
      S('passeport', 24, /\bpasseport\b/i),
      S('mali', 12, /\bmali\b/i),
      S('mrz-ppmli', 38, /ppmli[a-z<]/i),
      S('mrz-p-mli', 32, /p\s*<\s*mli/i),
      S('code-mli', 12, /\bmli\b/i),
      ...PASSPORT_FIELD_SIGNALS,
    ],
  },
  {
    id: 'cni-gn',
    kind: 'cni',
    country: 'GN',
    label: 'CNI Guinée',
    minScore: 38,
    softScore: 22,
    signals: [
      S('guinee', 16, /\bguinee\b|\bguinea\b/i),
      S('republique-guinee', 24, /republique\s+de\s+guinee|republique\s+guineenne/i),
      S('header-carte-nationale', 22, /carte\s+nationale\s+d'?identite/i),
      S('cni', 10, /\bcni\b/i),
      S('mrz-i-gin', 36, /i\s*<\s*gin/i),
      S('code-gin', 12, /\bgin\b/i),
      ...CNI_FIELD_SIGNALS,
    ],
  },
  {
    id: 'passport-gn',
    kind: 'passport',
    country: 'GN',
    label: 'Passeport Guinée',
    minScore: 38,
    softScore: 22,
    signals: [
      S('passeport', 24, /\bpasseport\b/i),
      S('guinee', 14, /\bguinee\b|\bguinea\b/i),
      S('mrz-ppgin', 38, /ppgin[a-z<]/i),
      S('mrz-p-gin', 32, /p\s*<\s*gin/i),
      S('code-gin', 12, /\bgin\b/i),
      ...PASSPORT_FIELD_SIGNALS,
    ],
  },
];

const GENERIC = [
  S('generic-carte', 18, /carte\s+nationale\s+d'?identite|\bcnib\b|\bcni\b/i),
  S('generic-passeport', 18, /\bpasseport\b|\bpassport\b/i),
  S('generic-mrz-i', 22, /i\s*<\s*(bfa|sen|mli|gin)/i),
  S('generic-mrz-p', 22, /p\s*<\s*(bfa|sen|mli|gin)|pp(bfa|sen|mli|gin)/i),
  S('generic-biodata', 8, /nationalit|date\s+de\s+naissance|given\s+names|prenoms/i),
];

function scoreSignals(text, signals) {
  const matched = [];
  let score = 0;
  for (const s of signals) {
    if (s.pattern.test(text)) {
      score += s.weight;
      matched.push(s.id);
    }
  }
  return { score, matched };
}

function hasStrongTypeSignal(kind, matched) {
  if (kind === 'cni') {
    return matched.some((id) => /header|cnib|carte|mrz-i|cni|nni/i.test(id));
  }
  return matched.some((id) => /passeport|passport|mrz-p|mrz-pp|passport-no|type-p/i.test(id));
}

function decide({ ocrText, expected }) {
  const text = normalizeIdOcr(ocrText);
  if (text.length < 12) return { ok: false, verdict: 'invalid' };

  const expectedProfiles = ALL.filter((p) => p.kind === expected);
  const oppositeProfiles = ALL.filter((p) => p.kind !== expected);
  const scoreP = (p) => ({ profile: p, ...scoreSignals(text, p.signals) });
  const bestExpected = expectedProfiles.map(scoreP).sort((a, b) => b.score - a.score)[0];
  const bestOpposite = oppositeProfiles.map(scoreP).sort((a, b) => b.score - a.score)[0];
  const generic = scoreSignals(text, GENERIC);

  const oppositeStrong =
    bestOpposite &&
    hasStrongTypeSignal(bestOpposite.profile.kind, bestOpposite.matched) &&
    bestOpposite.score >= bestOpposite.profile.softScore;

  if (
    oppositeStrong &&
    bestOpposite.score >= bestOpposite.profile.minScore - 8 &&
    bestOpposite.score > (bestExpected?.score ?? 0) + 12
  ) {
    return { ok: false, verdict: 'invalid', reason: 'wrong-type' };
  }

  const anyBest = ALL.map(scoreP).sort((a, b) => b.score - a.score)[0];
  if (
    anyBest &&
    anyBest.score >= anyBest.profile.minScore &&
    anyBest.profile.kind !== expected &&
    hasStrongTypeSignal(anyBest.profile.kind, anyBest.matched) &&
    anyBest.score > (bestExpected?.score ?? 0) + 8
  ) {
    return { ok: false, verdict: 'invalid', reason: 'wrong-type' };
  }

  const { profile, score, matched } = bestExpected;
  const strongType = hasStrongTypeSignal(expected, matched);

  const authorizedCountry =
    matched.some((id) =>
      /burkina|senegal|mali|guinee|bfa|sen|mli|gin|cnib|republique-(senegal|mali|guinee)/i.test(id)
    ) ||
    /(?:burkina\s*faso|\bsenegal\b|\bmali\b|\bguinee\b|\bguinea\b|\bbfa\b|\bsen\b|\bmli\b|\bgin\b)/i.test(
      text
    );

  const foreign =
    /\b(france|francaise|belgique|cote\s+d'?ivoire|ivoire|niger|togo|benin|cameroun|maroc|algerie)\b/i.test(
      text
    ) || /i\s*<\s*(fra|civ|ner|tgo|ben|cmr|mar)/i.test(text);

  if (foreign && !authorizedCountry) {
    return { ok: false, verdict: 'invalid', reason: 'foreign' };
  }

  if (score >= profile.minScore && (strongType || score >= profile.minScore + 18)) {
    return {
      ok: true,
      verdict: 'valid',
      country: profile.country,
      score,
      matched,
    };
  }

  const softHit = score >= profile.softScore;
  const genericHit = generic.score >= 18;
  const countryHint = matched.some((id) =>
    /burkina|senegal|mali|guinee|bfa|sen|mli|gin|cnib|republique/i.test(id)
  );

  if (
    (softHit && (strongType || countryHint || genericHit)) ||
    (genericHit && countryHint && score >= Math.max(12, profile.softScore - 8)) ||
    (strongType && countryHint && score >= profile.softScore - 4)
  ) {
    return { ok: true, verdict: 'uncertain', country: profile.country, score, matched };
  }

  if (generic.score < 10 && score < profile.softScore) {
    return { ok: false, verdict: 'invalid', reason: 'not-id', score, matched };
  }

  if (generic.score >= 10 || score >= 14) {
    return { ok: true, verdict: 'uncertain', score, matched };
  }

  return { ok: false, verdict: 'invalid', score, matched };
}

// --- Cas de test ---

const SAMPLES = [
  {
    name: 'CNI Burkina Faso (recto OCR)',
    expected: 'cni',
    want: ['valid'],
    text: `CARTE NATIONALE D'IDENTITE BURKINABE BURKINA FASO
Nom: SOULAMA Prenoms: MINON ABOUBACAR
Né(e) le: 21/02/1998 Sexe: M Taille: 178 cm Profession: ETUDIANT
Délivréele: 06/05/2022 Expire le: 05/05/2032 B17091884
Signature du titulaire Signature de l'autorité`,
  },
  {
    name: 'CNI BF sans deux-points (OCR bruité)',
    expected: 'cni',
    want: ['valid', 'uncertain'],
    text: `CARTE NATIONALE D IDENTITE BURKINABE BURKINA FASO
Nom SOULAMA Prenoms MINON Ne(e) le 21/02/1998
Sexe M Taille 178 Profession ETUDIANT
Delivree le 06/05/2022 Expire le 05/05/2032 B17091884`,
  },
  {
    name: 'Passeport Burkina Faso',
    expected: 'passport',
    want: ['valid'],
    text: `BURKINA FASO PASSEPORT Type / Type Code du pays / Country code N° de passeport / Passport No
P BFA A5120884 Nom / Surname OUEDRAOGO Prenoms / Given names MARTIAL
Nationalité / Nationality BURKINABE Date de naissance / Date of birth
PPBFAOUEDRAOGO<<MARTIAL A5120884<6BFA0706302M3106039<<<<<<<<<<<<<<06
DIRECTION GENERALE DE LA POLICE NATIONALE`,
  },
  {
    name: 'CNI Sénégal',
    expected: 'cni',
    want: ['valid'],
    text: `REPUBLIQUE DU SENEGAL CARTE NATIONALE D IDENTITE
Nom: DIOP Prenoms: AMINATA Sexe: F
I<SEN1234567890<<<<<<<<<<<<<<<`,
  },
  {
    name: 'Passeport Sénégal',
    expected: 'passport',
    want: ['valid'],
    text: `REPUBLIQUE DU SENEGAL PASSEPORT PASSPORT
Code SEN Nationalité SENEGALAISE
PPSENDIOP<<AMINATA<<<<<<<<<<<<<<<<
P<SEN123`,
  },
  {
    name: 'CNI Mali',
    expected: 'cni',
    want: ['valid'],
    text: `REPUBLIQUE DU MALI CARTE NATIONALE D IDENTITE
Nom: TRAORE Prenoms: IBRAHIM NNI 123
I<MLI9876543210<<<<<<<<<<<<<<<`,
  },
  {
    name: 'Passeport Mali',
    expected: 'passport',
    want: ['valid'],
    text: `REPUBLIQUE DU MALI PASSEPORT
Code MLI PPMLITRAORE<<IBRAHIM<<<<<<<<<<
P<MLIABC`,
  },
  {
    name: 'CNI Guinée',
    expected: 'cni',
    want: ['valid'],
    text: `REPUBLIQUE DE GUINEE CARTE NATIONALE D IDENTITE
Nom: CAMARA Prenoms: FATOUMATA
I<GIN1122334455<<<<<<<<<<<<<<<`,
  },
  {
    name: 'Passeport Guinée',
    expected: 'passport',
    want: ['valid'],
    text: `REPUBLIQUE DE GUINEE PASSEPORT PASSPORT
Code GIN PPGINCAMARA<<FATOUMATA<<<<<<<
P<GINXYZ`,
  },
  {
    name: 'Photo ordinaire (personne)',
    expected: 'cni',
    want: ['invalid'],
    text: 'hello my selfie beach smile vacation friends happy moment',
  },
  {
    name: 'Photo paysage',
    expected: 'cni',
    want: ['invalid'],
    text: 'mountain lake sunset trees nature landscape sky blue clouds',
  },
  {
    name: 'Capture écran sans document',
    expected: 'passport',
    want: ['invalid'],
    text: 'WhatsApp conversation yesterday ok see you tomorrow https://example.com',
  },
  {
    name: 'Document pays non autorisé (France)',
    expected: 'cni',
    want: ['invalid'],
    text: 'REPUBLIQUE FRANCAISE CARTE NATIONALE D IDENTITE FRANCE I<FRA123456',
  },
  {
    name: 'Image floue / OCR partiel CNIB',
    expected: 'cni',
    want: ['valid', 'uncertain'],
    text: `CARTE NATIONALE BURKINA FASO Nom Prenoms Taille Profession`,
  },
  {
    name: 'Document incliné — OCR partiel passeport BF',
    expected: 'passport',
    want: ['valid', 'uncertain'],
    text: `PASSEPORT BURKINA FASO BFA Nationalite BURKINABE Given names`,
  },
  {
    name: 'Passeport soumis comme CNI (mauvais type)',
    expected: 'cni',
    want: ['invalid'],
    text: `BURKINA FASO PASSEPORT Type / Type Code du pays Passport No
P BFA A5120884 PPBFAOUEDRAOGO<<MARTIAL POLICE NATIONALE`,
  },
  {
    name: 'CNI soumise comme passeport (mauvais type)',
    expected: 'passport',
    want: ['invalid'],
    text: `CARTE NATIONALE D'IDENTITE BURKINABE BURKINA FASO
Nom: X Prenoms: Y Né(e) le: 01/01/1990 Taille: 170 Profession: X
I<BFAB110977211<<<<<<<<<<<<<<<`,
  },
];

let passed = 0;
let failed = 0;
const failures = [];

console.log('=== Tests décision OCR (profils AfriZone) ===\n');

for (const sample of SAMPLES) {
  const result = decide({ ocrText: sample.text, expected: sample.expected });
  const ok = sample.want.includes(result.verdict);
  const mark = ok ? 'PASS' : 'FAIL';
  if (ok) passed += 1;
  else {
    failed += 1;
    failures.push({ sample: sample.name, result });
  }
  console.log(
    `${mark} | ${sample.name} → ${result.verdict}` +
      (result.score != null ? ` (score=${result.score})` : '') +
      (result.reason ? ` [${result.reason}]` : '') +
      (result.country ? ` ${result.country}` : '')
  );
}

console.log(`\nSynthétique: ${passed} pass / ${failed} fail / ${SAMPLES.length} total`);

if (WITH_OCR) {
  console.log('\n=== OCR images de référence (Tesseract) ===\n');
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('fra+eng');
  const files = [
    {
      path: 'docs/id-doc-references/cnib-bf-recto-exemple-1.jpg',
      expected: 'cni',
      want: ['valid', 'uncertain'],
      name: 'CNIB BF recto (image)',
    },
    {
      path: 'docs/id-doc-references/cnib-bf-recto-verso-exemple-2.jpg',
      expected: 'cni',
      want: ['valid', 'uncertain'],
      name: 'CNIB BF recto+verso (image)',
    },
    {
      path: 'docs/id-doc-references/passport-pages/page-03.jpg',
      expected: 'passport',
      want: ['valid', 'uncertain'],
      name: 'Passeport BF page biodata (image)',
    },
    {
      path: 'docs/id-doc-references/passport-pages/page-02.jpg',
      expected: 'passport',
      want: ['valid', 'uncertain', 'invalid'],
      name: 'Passeport BF page 2 (couverture/intérieur — peut échouer seul)',
    },
  ];

  for (const f of files) {
    const full = path.join(root, f.path);
    if (!fs.existsSync(full)) {
      console.log(`SKIP | ${f.name} — fichier manquant`);
      continue;
    }
    const { data } = await worker.recognize(full);
    const result = decide({ ocrText: data.text || '', expected: f.expected });
    const ok = f.want.includes(result.verdict);
    if (ok) passed += 1;
    else {
      failed += 1;
      failures.push({ sample: f.name, result, ocrLen: (data.text || '').length });
    }
    console.log(
      `${ok ? 'PASS' : 'FAIL'} | ${f.name} → ${result.verdict} (OCR conf=${data.confidence?.toFixed?.(0) ?? '?'}, score=${result.score ?? '-'}, chars=${(data.text || '').length})`
    );
    if (!ok) {
      console.log('  OCR excerpt:', normalizeIdOcr(data.text || '').slice(0, 180));
      console.log('  matched:', (result.matched || []).join(', '));
    }
  }
  await worker.terminate();
} else {
  console.log('\n(Astuce: ajoutez --ocr pour tester les JPEG de référence avec Tesseract)');
}

console.log(`\nTOTAL: ${passed} pass / ${failed} fail`);
if (failures.length) {
  console.log('\nÉchecs:');
  for (const f of failures) console.log('-', f.sample, JSON.stringify(f.result));
  process.exit(1);
}
process.exit(0);
