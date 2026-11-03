import { createWorker, type Worker } from 'tesseract.js';

export type IdDocKind = 'cni' | 'passport';
export type IdCountryCode = 'SN' | 'BF' | 'ML' | 'GN';

export type IdScanStepId =
  | 'load'
  | 'contours'
  | 'ocr'
  | 'country'
  | 'type'
  | 'authenticity'
  | 'match'
  | 'done';

export interface IdScanStep {
  id: IdScanStepId;
  label: string;
}

export interface IdScanResult {
  ok: boolean;
  detectedKind: IdDocKind | null;
  detectedCountry: IdCountryCode | null;
  confidence: number;
  error?: string;
  details: string[];
}

export const ID_SCAN_STEPS: IdScanStep[] = [
  { id: 'load', label: 'Chargement du document' },
  { id: 'contours', label: 'Détection des contours' },
  { id: 'ocr', label: 'Lecture OCR du texte' },
  { id: 'country', label: 'Pays (SN / BF / ML / GN)' },
  { id: 'type', label: 'Identification CNI·CNIB / Passeport' },
  { id: 'authenticity', label: 'Contrôle d’authenticité' },
  { id: 'match', label: 'Concordance stricte du type choisi' },
  { id: 'done', label: 'Scan terminé' },
];

const COUNTRY_LABEL: Record<IdCountryCode, string> = {
  SN: 'Sénégal',
  BF: 'Burkina Faso',
  ML: 'Mali',
  GN: 'Guinée',
};

/** Motifs pays (OCR bruyant → formes longues ; codes ISO seulement en contexte MRZ) */
const COUNTRY_PATTERNS: Record<IdCountryCode, RegExp[]> = {
  SN: [
    /\bsenegal\b/i,
    /\brepublique\s+du\s+senegal\b/i,
    /\bpasseport\s+du\s+senegal\b/i,
    /\bpasseport\s+senegal\b/i,
    /\bpassport\s+senegal\b/i,
    /[<«]SEN[<«A-Z]/i,
    /\bSEN[<«]/,
  ],
  BF: [
    /\bburkina\s*faso\b/i,
    /\brepublique\s+du\s+burkina\b/i,
    /\brepublique\s+burkina\b/i,
    /\bcnib\b/i,
    /\bpasseport\s+burkina\b/i,
    /[<«]BFA[<«A-Z]/i,
    /\bBFA[<«]/,
  ],
  ML: [
    /\brepublique\s+du\s+mali\b/i,
    /\bpasseport\s+du\s+mali\b/i,
    /\bpasseport\s+mali\b/i,
    /\bpassport\s+mali\b/i,
    /\bcarte\s+nationale[\s\S]{0,40}\bmali\b/i,
    /\bmali\b[\s\S]{0,40}\b(carte|passeport|passport|identite)\b/i,
    /\bmali\b/i,
    /[<«]MLI[<«A-Z]/i,
    /\bMLI[<«]/,
  ],
  GN: [
    /\bguinee\b/i,
    /\bguinea\b/i,
    /\brepublique\s+de\s+guinee\b/i,
    /\brepublique\s+guinee\b/i,
    /\bpasseport\s+guinee\b/i,
    /\bpasseport\s+guinea\b/i,
    /[<«]GIN[<«A-Z]/i,
    /\bGIN[<«]/,
  ],
};

const CNI_PATTERNS: RegExp[] = [
  /\bcarte\s+nationale\b/i,
  /\bcarte\s+d['’]?\s*identite\b/i,
  /\bcarte\s+nationale\s+d['’]?\s*identite\b/i,
  /\bidentite\s+nationale\b/i,
  /\bcnib\b/i,
  /\bcni\b/i,
  /\bnational\s+identity\s+card\b/i,
  /\bidentity\s+card\b/i,
  /\bcarte\s+didentite\b/i,
  /\bcarte\s+d['’]identite\b/i,
  // MRZ carte ID (ligne I< / ID)
  /(?:^|[\s\n])i[<«][a-z]{3}/im,
  /(?:^|[\s\n])id[<«]/im,
];

const PASSPORT_PATTERNS: RegExp[] = [
  /\bpasseport\b/i,
  /\bpassport\b/i,
  /\btravel\s+document\b/i,
  /\bdocument\s+de\s+voyage\b/i,
  // MRZ passeport : P<XXX (éviter les faux positifs trop larges)
  /(?:^|[\s\n])p[<«][a-z]{3}/im,
];

/** Décide CNI vs passeport de façon exclusive (pas d’ambiguïté douce). */
function resolveDocumentKind(
  cniHits: number,
  passportHits: number
): { kind: IdDocKind | null; exclusive: boolean } {
  if (cniHits <= 0 && passportHits <= 0) {
    return { kind: null, exclusive: false };
  }
  if (cniHits > 0 && passportHits <= 0) {
    return { kind: 'cni', exclusive: true };
  }
  if (passportHits > 0 && cniHits <= 0) {
    return { kind: 'passport', exclusive: true };
  }
  // Les deux présents : le plus fort gagne ; égalité = ambigu
  if (cniHits > passportHits) return { kind: 'cni', exclusive: true };
  if (passportHits > cniHits) return { kind: 'passport', exclusive: true };
  return { kind: null, exclusive: false };
}

const ECOWAS_CEDEAO: RegExp[] = [
  /\bcedea[o0]\b/i,
  /\becowas\b/i,
  /\bcommunaute\s+economique\b/i,
  /\bwest\s+african\b/i,
];

const GENERIC_ID_MARKERS: RegExp[] = [
  /\bnationalit[eé]\b/i,
  /\bdate\s+de\s+naissance\b/i,
  /\bdate\s+of\s+birth\b/i,
  /\bsexe\b/i,
  /\bsex\b/i,
  /\bprenom\b/i,
  /\bnom\b/i,
  /\bsurname\b/i,
  /\bgiven\s+names?\b/i,
  /\blieu\s+de\s+naissance\b/i,
  /\bplace\s+of\s+birth\b/i,
  /\bautorit[eé]\b/i,
  /\bdelivr[eé]\b/i,
  /\bexpires?\b/i,
  /\bexpiration\b/i,
  /\bvalidit[eé]\b/i,
  /\bmrz\b/i,
  /[A-Z0-9]{8,}<+[A-Z0-9<]{8,}/, // fragment MRZ
];

let workerPromise: Promise<Worker> | null = null;

async function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('fra+eng', 1, {
      logger: () => undefined,
    });
  }
  return workerPromise;
}

function normalizeOcrText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[«»]/g, '<')
    .replace(/\s+/g, ' ')
    .trim();
}

function countMatches(text: string, patterns: RegExp[]): number {
  let n = 0;
  for (const re of patterns) {
    if (re.test(text)) n += 1;
  }
  return n;
}

function detectCountries(text: string): { code: IdCountryCode; hits: number }[] {
  const scored = (Object.keys(COUNTRY_PATTERNS) as IdCountryCode[]).map((code) => ({
    code,
    hits: countMatches(text, COUNTRY_PATTERNS[code]),
  }));
  return scored.filter((s) => s.hits > 0).sort((a, b) => b.hits - a.hits);
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Impossible de lire l’image du document.'));
    };
    img.src = url;
  });
}

interface PixelStats {
  brightness: number;
  variance: number;
  width: number;
  height: number;
  aspect: number;
  edgeRatio: number;
  skinRatio: number;
  textLikeRatio: number;
  canvas: HTMLCanvasElement;
}

function analyzePixels(img: HTMLImageElement): PixelStats {
  const maxSide = 900;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Analyse image indisponible sur cet appareil.');
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  let sum = 0;
  let sumSq = 0;
  let n = 0;
  let edge = 0;
  let skin = 0;
  let textLike = 0;

  // Sobel léger + stats (pas tous les pixels)
  const step = 4;
  for (let y = 1; y < h - 1; y += step) {
    for (let x = 1; x < w - 1; x += step) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      sum += gray;
      sumSq += gray * gray;
      n += 1;

      // peau (selfie)
      const maxc = Math.max(r, g, b);
      const minc = Math.min(r, g, b);
      if (r > 95 && g > 40 && b > 20 && r > g && r > b && maxc - minc > 15 && Math.abs(r - g) > 15) {
        skin += 1;
      }

      const iRight = (y * w + (x + 1)) * 4;
      const iDown = ((y + 1) * w + x) * 4;
      const grayR = 0.299 * data[iRight] + 0.587 * data[iRight + 1] + 0.114 * data[iRight + 2];
      const grayD = 0.299 * data[iDown] + 0.587 * data[iDown + 1] + 0.114 * data[iDown + 2];
      const grad = Math.abs(gray - grayR) + Math.abs(gray - grayD);
      if (grad > 40) edge += 1;
      // zones « texte » : contraste local fort + gris moyen
      if (grad > 55 && gray > 40 && gray < 220) textLike += 1;
    }
  }

  const mean = sum / Math.max(1, n);
  const variance = sumSq / Math.max(1, n) - mean * mean;
  const aspect = img.width / Math.max(1, img.height);

  return {
    brightness: mean,
    variance,
    width: img.width,
    height: img.height,
    aspect,
    edgeRatio: edge / Math.max(1, n),
    skinRatio: skin / Math.max(1, n),
    textLikeRatio: textLike / Math.max(1, n),
    canvas,
  };
}

function aspectLooksLikeId(aspect: number, expected: IdDocKind): boolean {
  const landscape = aspect >= 1 ? aspect : 1 / aspect;
  if (expected === 'cni') {
    // carte ID ISO-ish
    return landscape >= 1.35 && landscape <= 1.95;
  }
  // passeport : page ouverte ou biodata (plus variable)
  return landscape >= 1.05 && landscape <= 1.85;
}

async function runOcr(canvas: HTMLCanvasElement): Promise<{ text: string; confidence: number }> {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(canvas);
  const text = normalizeOcrText(data.text || '');
  return { text, confidence: data.confidence ?? 0 };
}

/**
 * Analyse stricte : OCR + mots-clés CNI/passeport des 4 pays AfriZone.
 * Refuse les images génériques. L’admin reste la validation métier finale.
 */
export async function analyzeIdDocument(
  file: File,
  expected: IdDocKind
): Promise<IdScanResult> {
  const details: string[] = [];

  if (!file) {
    return {
      ok: false,
      detectedKind: null,
      detectedCountry: null,
      confidence: 0,
      error: 'Aucun fichier.',
      details,
    };
  }

  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const isImage =
    file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name);

  if (isPdf) {
    return {
      ok: false,
      detectedKind: null,
      detectedCountry: null,
      confidence: 0,
      error:
        'Pour vérifier l’authenticité, uploadez une photo nette (JPG/PNG/WEBP) de la CNI ou du passeport — pas un PDF.',
      details: ['PDF refusé : OCR d’identité impossible de façon fiable'],
    };
  }

  if (!isImage) {
    return {
      ok: false,
      detectedKind: null,
      detectedCountry: null,
      confidence: 0,
      error: 'Format invalide. Photo JPG, PNG ou WEBP d’une CNI ou d’un passeport requise.',
      details,
    };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImageFromFile(file);
  } catch (e) {
    return {
      ok: false,
      detectedKind: null,
      detectedCountry: null,
      confidence: 0,
      error: e instanceof Error ? e.message : 'Lecture image impossible.',
      details,
    };
  }

  let stats: PixelStats;
  try {
    stats = analyzePixels(img);
  } catch (e) {
    return {
      ok: false,
      detectedKind: null,
      detectedCountry: null,
      confidence: 0,
      error: e instanceof Error ? e.message : 'Analyse image impossible.',
      details,
    };
  }

  details.push(`Résolution ${stats.width}×${stats.height}px`);

  if (stats.width < 640 || stats.height < 400) {
    return {
      ok: false,
      detectedKind: null,
      detectedCountry: null,
      confidence: 0.15,
      error: 'Image trop petite. Cadrez la pièce entière (min. ~640×400 px), texte lisible.',
      details,
    };
  }

  if (stats.brightness < 40 || stats.brightness > 235) {
    return {
      ok: false,
      detectedKind: null,
      detectedCountry: null,
      confidence: 0.2,
      error: 'Éclairage insuffisant ou surexposé. Reprenez la photo à plat, sans flash direct.',
      details,
    };
  }

  if (stats.variance < 350) {
    return {
      ok: false,
      detectedKind: null,
      detectedCountry: null,
      confidence: 0.2,
      error: 'Image floue ou peu contrastée. Document net obligatoire.',
      details,
    };
  }

  // Selfie / visage dominant → refus
  if (stats.skinRatio > 0.28 && stats.textLikeRatio < 0.08) {
    return {
      ok: false,
      detectedKind: null,
      detectedCountry: null,
      confidence: 0.1,
      error: 'Cela ressemble à une photo de personne, pas à une pièce d’identité. Photographiez la CNI ou le passeport.',
      details,
    };
  }

  if (stats.edgeRatio < 0.06 || stats.textLikeRatio < 0.035) {
    return {
      ok: false,
      detectedKind: null,
      detectedCountry: null,
      confidence: 0.15,
      error:
        'Aucun document d’identité détecté (pas assez de structure / texte). Uploadez une CNI ou un passeport net des pays AfriZone.',
      details,
    };
  }

  if (!aspectLooksLikeId(stats.aspect, expected)) {
    details.push(`Ratio ${stats.aspect.toFixed(2)} atypique pour ${expected === 'cni' ? 'CNI' : 'passeport'}`);
    return {
      ok: false,
      detectedKind: null,
      detectedCountry: null,
      confidence: 0.25,
      error:
        expected === 'cni'
          ? 'Le cadrage ne correspond pas à une CNI. Photographiez la carte à l’horizontale, entière.'
          : 'Le cadrage ne correspond pas à un passeport. Photographiez la page d’identité entière.',
      details,
    };
  }

  details.push('Contours / structure document : OK');

  let ocrText = '';
  let ocrConf = 0;
  try {
    const ocr = await runOcr(stats.canvas);
    ocrText = ocr.text;
    ocrConf = ocr.confidence;
  } catch {
    return {
      ok: false,
      detectedKind: null,
      detectedCountry: null,
      confidence: 0,
      error: 'Échec de la lecture OCR. Réessayez avec une photo plus nette et bien cadrée.',
      details,
    };
  }

  details.push(`OCR confiance ${(ocrConf || 0).toFixed(0)} % · ${ocrText.length} caractères`);

  if (ocrText.length < 40 || ocrConf < 35) {
    return {
      ok: false,
      detectedKind: null,
      detectedCountry: null,
      confidence: 0.2,
      error:
        'Texte illisible sur le document. Reprenez une photo nette de votre CNI ou passeport (SN, BF, ML ou GN).',
      details,
    };
  }

  const countries = detectCountries(ocrText);
  const cniHits = countMatches(ocrText, CNI_PATTERNS);
  const passportHits = countMatches(ocrText, PASSPORT_PATTERNS);
  const ecoHits = countMatches(ocrText, ECOWAS_CEDEAO);
  const markerHits = countMatches(ocrText, GENERIC_ID_MARKERS);
  const { kind: detectedKind } = resolveDocumentKind(cniHits, passportHits);

  details.push(`Marqueurs OCR · CNI/CNIB=${cniHits} · passeport=${passportHits}`);

  if (countries.length === 0) {
    return {
      ok: false,
      detectedKind,
      detectedCountry: null,
      confidence: 0.2,
      error:
        'Pays non reconnu. Seules les CNI / CNIB / passeports du Sénégal, Burkina Faso, Mali et Guinée sont acceptés.',
      details: [...details, `Champs ID=${markerHits}`],
    };
  }

  const topCountry = countries[0];
  details.push(`Pays détecté : ${COUNTRY_LABEL[topCountry.code]} (${topCountry.hits} indice(s))`);

  // ── Concordance type STRICTE (CNI/CNIB ≠ passeport) ──────────────
  if (expected === 'cni') {
    if (passportHits > 0 && cniHits === 0) {
      return {
        ok: false,
        detectedKind: 'passport',
        detectedCountry: topCountry.code,
        confidence: 0.35,
        error:
          'Un passeport a été détecté, pas une CNI/CNIB. Sélectionnez « Passeport » ou uploadez votre carte d’identité.',
        details,
      };
    }
    if (passportHits > cniHits) {
      return {
        ok: false,
        detectedKind: 'passport',
        detectedCountry: topCountry.code,
        confidence: 0.4,
        error:
          'Le document correspond à un passeport, pas à une CNI/CNIB. Changez le type ou le fichier.',
        details,
      };
    }
    if (cniHits === 0) {
      return {
        ok: false,
        detectedKind: null,
        detectedCountry: topCountry.code,
        confidence: 0.25,
        error:
          'Mentions CNI/CNIB introuvables. Photographiez le recto de votre carte nationale d’identité (pas un passeport).',
        details: [...details, `Champs ID=${markerHits}, CEDEAO=${ecoHits}`],
      };
    }
  }

  if (expected === 'passport') {
    if (cniHits > 0 && passportHits === 0) {
      return {
        ok: false,
        detectedKind: 'cni',
        detectedCountry: topCountry.code,
        confidence: 0.35,
        error:
          'Une CNI/CNIB a été détectée, pas un passeport. Sélectionnez « CNI » ou uploadez votre passeport.',
        details,
      };
    }
    if (cniHits > passportHits) {
      return {
        ok: false,
        detectedKind: 'cni',
        detectedCountry: topCountry.code,
        confidence: 0.4,
        error:
          'Le document correspond à une CNI/CNIB, pas à un passeport. Changez le type ou le fichier.',
        details,
      };
    }
    if (passportHits === 0) {
      return {
        ok: false,
        detectedKind: null,
        detectedCountry: topCountry.code,
        confidence: 0.25,
        error:
          'Mentions passeport introuvables. Photographiez la page d’identité du passeport (pas une CNI).',
        details: [...details, `Champs ID=${markerHits}, CEDEAO=${ecoHits}`],
      };
    }
  }

  if (!detectedKind || detectedKind !== expected) {
    return {
      ok: false,
      detectedKind,
      detectedCountry: topCountry.code,
      confidence: 0.3,
      error:
        expected === 'cni'
          ? 'Type non concordant : une CNI ou CNIB est requise (pas un passeport).'
          : 'Type non concordant : un passeport est requis (pas une CNI/CNIB).',
      details,
    };
  }

  // Score global (uniquement après concordance type)
  let score = 0;
  score += Math.min(3, topCountry.hits) * 18;
  score +=
    Math.min(3, expected === 'cni' ? cniHits : passportHits) * 18;
  score += Math.min(4, markerHits) * 7;
  score += Math.min(2, ecoHits) * 5;
  score += ocrConf >= 55 ? 10 : ocrConf >= 40 ? 5 : 0;
  score += 14; // concordance type déjà vérifiée
  if (aspectLooksLikeId(stats.aspect, expected)) score += 6;

  const confidence = Math.min(0.97, score / 100);
  details.push(
    `Score authenticité ${score}/100 · type : ${
      expected === 'cni' ? 'CNI/CNIB' : 'Passeport'
    }`
  );

  if (score < 52) {
    return {
      ok: false,
      detectedKind,
      detectedCountry: topCountry.code,
      confidence,
      error:
        'Document non validé. Fournissez une photo claire de votre CNI/CNIB ou passeport (Sénégal, Burkina Faso, Mali ou Guinée).',
      details,
    };
  }

  details.push(
    `Concordance stricte ${expected === 'cni' ? 'CNI/CNIB' : 'Passeport'} · ${COUNTRY_LABEL[topCountry.code]} : OK`
  );

  return {
    ok: true,
    detectedKind: expected,
    detectedCountry: topCountry.code,
    confidence: Math.max(confidence, 0.65),
    details,
  };
}
