import { createWorker, type Worker } from 'tesseract.js';
import {
  bestProfilesFor,
  normalizeIdOcr,
  scoreSignals,
  CNI_FIELD_SIGNALS,
  PASSPORT_FIELD_SIGNALS,
  HEADER_CARTE_IDENTITE,
  OTHER_DOCUMENT_PATTERNS,
  type IdCountryCode,
  type IdDocKind,
} from './id-doc-profiles';
import {
  extractCniDates,
  isAuthorizedMrzCountry,
  isExpired,
  parseMrz,
  type MrzParseResult,
} from './id-mrz';

export type { IdCountryCode, IdDocKind };

export type IdScanStepId =
  | 'load'
  | 'contours'
  | 'ocr'
  | 'country'
  | 'type'
  | 'authenticity'
  | 'match'
  | 'done';

export type IdScanVerdict = 'valid' | 'invalid' | 'uncertain';

export interface IdScanStep {
  id: IdScanStepId;
  label: string;
}

export interface IdScanResult {
  /** true si l'utilisateur peut continuer (valid ou uncertain) */
  ok: boolean;
  verdict: IdScanVerdict;
  detectedKind: IdDocKind | null;
  detectedCountry: IdCountryCode | null;
  confidence: number;
  error?: string;
  message?: string;
  details: string[];
}

export const ID_SCAN_STEPS: IdScanStep[] = [
  { id: 'load', label: 'Chargement du document' },
  { id: 'contours', label: 'Détection des contours' },
  { id: 'ocr', label: 'Lecture OCR du texte' },
  { id: 'country', label: 'Pays (SN / BF / ML / GN)' },
  { id: 'type', label: 'Identification CNI·CNIB / Passeport' },
  { id: 'authenticity', label: 'Contrôle d’authenticité' },
  { id: 'match', label: 'Concordance du type choisi' },
  { id: 'done', label: 'Scan terminé' },
];

const COUNTRY_LABEL: Record<IdCountryCode, string> = {
  SN: 'Sénégal',
  BF: 'Burkina Faso',
  ML: 'Mali',
  GN: 'Guinée',
};

const MRZ_TO_COUNTRY: Record<string, IdCountryCode> = {
  BFA: 'BF',
  SEN: 'SN',
  MLI: 'ML',
  GIN: 'GN',
};

const UNREADABLE_MESSAGE =
  'Nous n’avons pas pu lire correctement votre document. Reprenez la photo en plein jour, à plat, sans reflet, avec la pièce entière dans le cadre.';

let workerPromise: Promise<Worker> | null = null;

async function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('fra+eng', 1, {
      logger: () => undefined,
    });
  }
  return workerPromise;
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

/** Vérifie le type réel du fichier (magic bytes), pas seulement l’extension. */
export async function detectRealFileKind(
  file: File
): Promise<'jpeg' | 'png' | 'webp' | 'pdf' | 'unknown'> {
  const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'jpeg';
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'png';
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'webp';
  }
  if (
    buf.length >= 5 &&
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46
  ) {
    return 'pdf';
  }
  return 'unknown';
}

/**
 * Réduit une photo de téléphone (souvent 4000×3000, 4-10 Mo) avant analyse et upload :
 * côté long ≤ 2000 px, JPEG. L'orientation EXIF est appliquée par le navigateur.
 * Les PDF et les petites images sont renvoyés tels quels.
 */
export async function prepareIdDocumentImage(file: File): Promise<File> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (isPdf) return file;

  try {
    const img = await loadImageFromFile(file);
    const longest = Math.max(img.width, img.height);
    const MAX_SIDE = 2000;
    if (longest <= MAX_SIDE && file.size <= 1.5 * 1024 * 1024 && file.type === 'image/jpeg') {
      return file;
    }
    const scale = Math.min(1, MAX_SIDE / longest);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9)
    );
    if (!blob || blob.size === 0) return file;
    // Si la recompression n'apporte rien, on garde l'original
    if (blob.size >= file.size && longest <= MAX_SIDE) return file;

    const base = file.name.replace(/\.[^.]+$/, '') || 'document';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** Rasterise les 1ères pages d’un PDF scanné (passeport multi-pages). */
async function rasterizePdfToCanvases(file: File, maxPages = 4): Promise<HTMLCanvasElement[]> {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const canvases: HTMLCanvasElement[] = [];

  const pageIndexes: number[] = [];
  if (doc.numPages <= 2) {
    for (let i = 1; i <= doc.numPages; i++) pageIndexes.push(i);
  } else {
    pageIndexes.push(1, Math.min(2, doc.numPages), Math.min(3, doc.numPages));
    if (doc.numPages >= 4) pageIndexes.push(4);
  }
  const unique = [...new Set(pageIndexes)].slice(0, maxPages);

  for (const pageNum of unique) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.7 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;
    canvases.push(canvas);
  }
  return canvases;
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
}

function analyzeCanvasPixels(canvas: HTMLCanvasElement): PixelStats {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Analyse image indisponible.');
  const w = canvas.width;
  const h = canvas.height;
  const { data } = ctx.getImageData(0, 0, w, h);

  let sum = 0;
  let sumSq = 0;
  let n = 0;
  let edge = 0;
  let skin = 0;
  let textLike = 0;
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
      if (grad > 55 && gray > 40 && gray < 220) textLike += 1;
    }
  }

  const mean = sum / Math.max(1, n);
  return {
    brightness: mean,
    variance: sumSq / Math.max(1, n) - mean * mean,
    width: w,
    height: h,
    aspect: w / Math.max(1, h),
    edgeRatio: edge / Math.max(1, n),
    skinRatio: skin / Math.max(1, n),
    textLikeRatio: textLike / Math.max(1, n),
  };
}

/** Prétraitement : redimensionnement + étirement de contraste léger. */
function imageToAnalysisCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const maxSide = 1800;
  const minSide = 1000;
  const longest = Math.max(img.width, img.height);
  let scale = Math.min(1, maxSide / longest);
  if (longest < minSide) {
    scale = Math.min(2, minSide / longest);
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas indisponible.');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Contraste léger pour OCR sur photos smartphone
  try {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;
    let min = 255;
    let max = 0;
    for (let i = 0; i < d.length; i += 16) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (g < min) min = g;
      if (g > max) max = g;
    }
    const range = Math.max(1, max - min);
    if (range < 180) {
      const factor = 220 / range;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.min(255, Math.max(0, (d[i] - min) * factor));
        d[i + 1] = Math.min(255, Math.max(0, (d[i + 1] - min) * factor));
        d[i + 2] = Math.min(255, Math.max(0, (d[i + 2] - min) * factor));
      }
      ctx.putImageData(imageData, 0, 0);
    }
  } catch {
    // ignore preprocessing failure — OCR continues on raw canvas
  }

  return canvas;
}

/** Rotation du canvas (90 / 180 / 270°) pour les photos prises « de travers ». */
function rotateCanvas(src: HTMLCanvasElement, degrees: 90 | 180 | 270): HTMLCanvasElement {
  const swap = degrees !== 180;
  const out = document.createElement('canvas');
  out.width = swap ? src.height : src.width;
  out.height = swap ? src.width : src.height;
  const ctx = out.getContext('2d');
  if (!ctx) return src;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}

/**
 * Niveaux de gris + seuillage d'Otsu : aide l'OCR quand la photo a des reflets
 * ou un fond coloré (cartes plastifiées).
 */
function binarizeCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return src;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;

  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    hist[g] += 1;
  }
  const total = d.length / 4;
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  // Seuil légèrement relevé : le texte imprimé reste net, le fond clair disparaît
  const cut = Math.min(235, threshold + 12);
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = g > cut ? 255 : 0;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

async function runOcrOnCanvas(
  canvas: HTMLCanvasElement
): Promise<{ text: string; confidence: number }> {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(canvas);
  // Texte BRUT : les retours à la ligne sont nécessaires à la lecture de la MRZ.
  return {
    text: data.text || '',
    confidence: data.confidence ?? 0,
  };
}

function successMessage(kind: IdDocKind, country: IdCountryCode | null): string {
  const countryPart = country ? ` (${COUNTRY_LABEL[country]})` : '';
  return kind === 'passport'
    ? `Passeport détecté avec succès${countryPart}.`
    : `Carte nationale d'identité détectée avec succès${countryPart}.`;
}

function failResult(
  partial: Partial<IdScanResult> & { error: string; details: string[] }
): IdScanResult {
  return {
    ok: false,
    verdict: 'invalid',
    detectedKind: null,
    detectedCountry: null,
    confidence: 0,
    message: partial.error,
    ...partial,
  };
}

export interface OcrDecisionInput {
  /** Texte OCR brut (avec retours à la ligne) ou déjà normalisé. */
  ocrText: string;
  ocrConfidence: number;
  expected: IdDocKind;
  details?: string[];
  /** Date de référence (tests). Par défaut : maintenant. */
  now?: Date;
}

/* ───────────────────────────  Pays / étranger  ─────────────────────────── */

/**
 * Pays reconnu par son NOM sur le document (les codes à 3 lettres ne sont pris
 * en compte que dans la MRZ, où ils sont fiables, pas dans du texte OCR bruité).
 */
const COUNTRY_TEXT: Array<{ code: IdCountryCode; pattern: RegExp }> = [
  { code: 'BF', pattern: /burkina|burkinab|\bcnib\b/i },
  { code: 'SN', pattern: /\bsenegal|senegalais/i },
  { code: 'ML', pattern: /\bmali\b|\bmalien/i },
  { code: 'GN', pattern: /\bguinee\b|\bguinea\b|guineen/i },
];

const FOREIGN_TEXT =
  /\b(france|francaise|belgique|cote\s+d'?ivoire|ivoirienne|niger|togo|benin|cameroun|maroc|algerie|tunisie|gabon|congo|rwanda|kenya|nigeria|ghana|usa|united\s+states|canada|portugal|espagne|allemagne|mauritanie|gambie|liberia|sierra\s+leone)\b/i;

function detectCountry(text: string, mrz: MrzParseResult): IdCountryCode | null {
  const fromMrz =
    mrz.line1?.country ?? mrz.line2?.nationality ?? mrz.idCardCountry ?? null;
  if (fromMrz && MRZ_TO_COUNTRY[fromMrz]) return MRZ_TO_COUNTRY[fromMrz];
  for (const c of COUNTRY_TEXT) {
    if (c.pattern.test(text)) return c.code;
  }
  return null;
}

function mrzCountries(mrz: MrzParseResult): string[] {
  const list: string[] = [];
  if (mrz.line1?.country) list.push(mrz.line1.country);
  if (mrz.line2?.nationality) list.push(mrz.line2.nationality);
  if (mrz.idCardCountry) list.push(mrz.idCardCountry);
  return list;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { timeZone: 'UTC' });
}

const FOREIGN_MESSAGE =
  'Ce document ne provient pas d’un pays autorisé (Sénégal, Burkina Faso, Mali, Guinée).';

const OTHER_DOC_EXEMPT_FIELDS = 6;

/* ─────────────────────────────  Décision CNI  ───────────────────────────── */

interface DecisionContext {
  raw: string;
  text: string;
  mrz: MrzParseResult;
  country: IdCountryCode | null;
  ocrConfidence: number;
  details: string[];
  now: Date;
}

function evaluateCni(ctx: DecisionContext): IdScanResult {
  const { text, mrz, country, details, now, ocrConfidence } = ctx;

  const header = HEADER_CARTE_IDENTITE.test(text) || /\bcnib\b/i.test(text);
  const mrzCard = !!mrz.idCardCountry;
  /** Verso de la carte : MRZ authentifiée par ses chiffres de contrôle OACI. */
  const mrzCardChecks = mrz.idCard?.checksPassed ?? 0;
  const mrzCardAuthentic = mrzCardChecks >= 2;
  const strong = header || mrzCard;

  const fields = scoreSignals(text, CNI_FIELD_SIGNALS);
  const fieldIds = fields.matched.filter((id) => id !== 'cedea');
  const fieldCount = fieldIds.length;
  const hasSerial = /\bB\d{7,10}\b/.test(text);
  const hasLongId = /\b\d{15,19}\b/.test(text);
  const cardStructure = hasSerial && hasLongId;

  const ranking = bestProfilesFor(text, 'cni');
  const best = ranking.find((r) => r.profile.country === country) ?? ranking[0];
  const profileScore = best?.score ?? 0;
  const minScore = best?.profile.minScore ?? 40;

  details.push(
    `CNI : en-tête ${header ? 'oui' : 'non'}, MRZ ${mrzCard ? `oui (${mrzCardChecks}/3)` : 'non'}, champs ${fieldCount}, n°+série ${cardStructure ? 'oui' : 'non'}, score ${profileScore}/${minScore}`
  );

  // Un passeport présenté comme CNI
  const passportEvidence =
    !!mrz.line1 || (mrz.line2?.checksPassed ?? 0) >= 2 || /\bpasse?port\b/i.test(text);
  if (passportEvidence && !strong) {
    return failResult({
      detectedKind: 'passport',
      detectedCountry: country,
      confidence: 0.8,
      error: 'Le document détecté ne correspond pas au type sélectionné (c’est un passeport).',
      details,
    });
  }

  // Autre pièce qui ressemble à une CNI (permis, attestation, carte d'électeur…)
  const other = OTHER_DOCUMENT_PATTERNS.find((p) => p.pattern.test(text));
  const exempt = mrzCardAuthentic || (cardStructure && fieldCount >= OTHER_DOC_EXEMPT_FIELDS);
  if (other && !exempt) {
    return failResult({
      confidence: 0.15,
      error: `Ce document semble être ${other.label}, pas une carte nationale d’identité. Présentez le recto de votre CNI/CNIB.`,
      details: [...details, `Document détecté : ${other.id}`],
    });
  }

  if (!country) {
    return failResult({
      confidence: 0.2,
      error: `${FOREIGN_MESSAGE} Aucun de ces pays n’a été reconnu sur le document.`,
      details,
    });
  }

  // Carte expirée : date de la MRZ (fiable si son chiffre de contrôle est bon)…
  if (mrz.idCard?.expiry && mrz.idCard.expiryReliable && isExpired(mrz.idCard.expiry, now)) {
    return failResult({
      detectedKind: 'cni',
      detectedCountry: country,
      confidence: 0.6,
      error: `Cette carte est expirée (le ${formatDate(mrz.idCard.expiry)}). Une pièce en cours de validité est exigée.`,
      details,
    });
  }
  // …ou dates imprimées au recto (lues et cohérentes entre elles uniquement)
  const dates = extractCniDates(text);
  if (dates.coherent && dates.expiry && isExpired(dates.expiry, now)) {
    return failResult({
      detectedKind: 'cni',
      detectedCountry: country,
      confidence: 0.6,
      error: `Cette carte est expirée (le ${formatDate(dates.expiry)}). Une pièce en cours de validité est exigée.`,
      details,
    });
  }
  if (dates.coherent) details.push('Dates de la carte : cohérentes');

  const confidence = Math.min(
    0.97,
    0.4 + profileScore / 180 + ocrConfidence / 500 + (dates.coherent ? 0.05 : 0)
  );

  // CNIB burkinabè : le recto porte un n° à ~17 chiffres + une série « B… » ; sans ces deux
  // éléments (ou des dates cohérentes), on ne valide pas automatiquement (revue admin).
  const bfStructureOk = country !== 'BF' || cardStructure || mrzCard || (fieldCount >= 5 && dates.coherent);

  // VALIDE (verso) : MRZ de la carte authentifiée par ses chiffres de contrôle OACI
  if (mrzCardAuthentic && country) {
    details.push(`Validé · verso · MRZ authentifiée (${mrzCardChecks}/3 chiffres de contrôle OACI)`);
    return {
      ok: true,
      verdict: 'valid',
      detectedKind: 'cni',
      detectedCountry: country,
      confidence: Math.min(0.98, confidence + 0.1),
      message: successMessage('cni', country),
      details,
    };
  }

  // VALIDE (recto) : en-tête de carte d'identité + pays autorisé + au moins 3 champs de la carte
  if (strong && fieldCount >= 3 && profileScore >= minScore && bfStructureOk) {
    details.push(`Validé · ${best?.profile.label ?? 'CNI'} · ${fieldIds.slice(0, 8).join(', ')}`);
    return {
      ok: true,
      verdict: 'valid',
      detectedKind: 'cni',
      detectedCountry: country,
      confidence,
      message: successMessage('cni', country),
      details,
    };
  }

  // INCERTAIN (revue admin) : indices sérieux mais lecture incomplète
  if ((strong && fieldCount >= 2) || (!strong && fieldCount >= 5 && cardStructure)) {
    details.push(`Incertain · champs ${fieldCount}, score ${profileScore}/${minScore}`);
    return {
      ok: true,
      verdict: 'uncertain',
      detectedKind: 'cni',
      detectedCountry: country,
      confidence: Math.min(0.55, confidence),
      message:
        'Lecture incomplète de votre carte. Vous pouvez continuer (un administrateur vérifiera la pièce) ou reprendre une photo plus nette.',
      details,
    };
  }

  return failResult({
    detectedKind: strong ? 'cni' : null,
    detectedCountry: country,
    confidence: Math.min(0.45, profileScore / 100),
    error: strong
      ? 'Carte reconnue mais illisible : cadrez le recto entier (photo, nom, prénoms, dates) en pleine lumière.'
      : 'Ce document ne semble pas être une carte nationale d’identité (SN, BF, ML, GN). Cadrez le recto de la carte, texte lisible.',
    details,
  });
}

/* ────────────────────────────  Décision passeport  ──────────────────────── */

function evaluatePassport(ctx: DecisionContext): IdScanResult {
  const { text, mrz, country, details, now, ocrConfidence } = ctx;

  const hasWord = /\bpasse?port\b/i.test(text);
  const line1 = mrz.line1;
  const line2 = mrz.line2;
  const mrzFound = !!line1 || !!line2;
  const mrzChecks = line2?.checksPassed ?? 0;

  const fields = scoreSignals(text, PASSPORT_FIELD_SIGNALS);
  const fieldCount = fields.matched.length;

  const ranking = bestProfilesFor(text, 'passport');
  const best = ranking.find((r) => r.profile.country === country) ?? ranking[0];
  const profileScore = best?.score ?? 0;
  const minScore = best?.profile.minScore ?? 40;

  details.push(
    `Passeport : mot ${hasWord ? 'oui' : 'non'}, MRZ ${line1 ? 'L1' : '—'}/${line2 ? 'L2' : '—'}, contrôles ${mrzChecks}/3, champs ${fieldCount}, score ${profileScore}/${minScore}`
  );

  const cniHeader =
    HEADER_CARTE_IDENTITE.test(text) || /\bcnib\b/i.test(text) || (!!mrz.idCard && !line1);
  if (cniHeader && !mrzFound && !hasWord) {
    return failResult({
      detectedKind: 'cni',
      detectedCountry: country,
      confidence: 0.8,
      error: 'Le document détecté ne correspond pas au type sélectionné (c’est une carte d’identité).',
      details,
    });
  }

  if (mrz.isVisa && mrzChecks < 2) {
    return failResult({
      confidence: 0.2,
      error: 'Cette page est un visa, pas la page d’identité du passeport (photo + 2 lignes en bas).',
      details,
    });
  }

  // Pays de la MRZ : au moins un code lu doit être autorisé
  const codes = mrzCountries(mrz);
  if (codes.length > 0 && !codes.some((c) => isAuthorizedMrzCountry(c))) {
    return failResult({
      confidence: 0.25,
      error: FOREIGN_MESSAGE,
      details: [...details, `Code pays MRZ : ${codes.join('/')}`],
    });
  }
  if (codes.length === 0 && FOREIGN_TEXT.test(text) && !COUNTRY_TEXT.some((c) => c.pattern.test(text))) {
    return failResult({ confidence: 0.25, error: FOREIGN_MESSAGE, details });
  }

  // Autre pièce (attestation, formulaire…) : refusée, sauf MRZ authentifiée par ses chiffres
  const other = OTHER_DOCUMENT_PATTERNS.find((p) => p.pattern.test(text));
  if (other && mrzChecks < 2) {
    return failResult({
      confidence: 0.15,
      error: `Ce document semble être ${other.label}, pas un passeport. Présentez la page d’identité (photo + 2 lignes en bas).`,
      details: [...details, `Document détecté : ${other.id}`],
    });
  }

  // Passeport expiré : seulement si la date est fiable (chiffre de contrôle correct)
  if (line2?.expiry && line2.expiryReliable && isExpired(line2.expiry, now)) {
    return failResult({
      detectedKind: 'passport',
      detectedCountry: country,
      confidence: 0.6,
      error: `Ce passeport est expiré (le ${formatDate(line2.expiry)}). Un passeport en cours de validité est exigé.`,
      details,
    });
  }

  const authorized = country !== null;
  const mrzAuthorized =
    (!!line1 && isAuthorizedMrzCountry(line1.country)) ||
    (!!line2 && isAuthorizedMrzCountry(line2.nationality));

  const confidence = Math.min(
    0.98,
    0.4 + profileScore / 180 + ocrConfidence / 500 + (mrzChecks >= 3 ? 0.12 : mrzChecks === 2 ? 0.06 : 0)
  );

  const valid =
    authorized &&
    ((mrzChecks >= 2 && mrzAuthorized) ||
      (!!line1 && mrzAuthorized && profileScore >= minScore) ||
      (hasWord && fieldCount >= 4 && profileScore >= minScore));

  if (valid) {
    details.push(
      mrzChecks >= 2
        ? `Validé · MRZ authentifiée (${mrzChecks}/3 chiffres de contrôle OACI)`
        : `Validé · ${best?.profile.label ?? 'Passeport'}`
    );
    return {
      ok: true,
      verdict: 'valid',
      detectedKind: 'passport',
      detectedCountry: country,
      confidence,
      message: successMessage('passport', country),
      details,
    };
  }

  if (authorized && (mrzFound || hasWord) && (profileScore >= (best?.profile.softScore ?? 24) || fieldCount >= 3)) {
    details.push(`Incertain · score ${profileScore}/${minScore}`);
    return {
      ok: true,
      verdict: 'uncertain',
      detectedKind: 'passport',
      detectedCountry: country,
      confidence: Math.min(0.55, confidence),
      message:
        'Lecture incomplète de votre passeport. Vous pouvez continuer (un administrateur vérifiera la pièce) ou reprendre une photo plus nette (page d’identité + 2 lignes en bas).',
      details,
    };
  }

  return failResult({
    detectedKind: mrzFound || hasWord ? 'passport' : null,
    detectedCountry: country,
    confidence: Math.min(0.4, profileScore / 100),
    error:
      mrzFound || hasWord
        ? 'Passeport reconnu mais illisible : cadrez la page d’identité entière (photo + les 2 lignes MRZ en bas).'
        : 'Ce document ne semble pas être un passeport (SN, BF, ML, GN). Cadrez la page d’identité : photo + 2 lignes en bas.',
    details,
  });
}

/**
 * Décision pure à partir du texte OCR — testable sans DOM.
 * Retourne valid / invalid / uncertain.
 */
export function decideIdDocumentFromOcr(input: OcrDecisionInput): IdScanResult {
  const details = [...(input.details ?? [])];
  const raw = input.ocrText || '';
  const text = normalizeIdOcr(raw);
  const now = input.now ?? new Date();

  if (text.length < 12) {
    return failResult({
      confidence: 0.12,
      error: UNREADABLE_MESSAGE,
      details: [...details, `OCR trop court (${text.length} car.)`],
    });
  }

  const mrz = parseMrz(raw, now);
  const ctx: DecisionContext = {
    raw,
    text,
    mrz,
    country: detectCountry(text, mrz),
    ocrConfidence: input.ocrConfidence,
    details,
    now,
  };

  return input.expected === 'cni' ? evaluateCni(ctx) : evaluatePassport(ctx);
}

/* ───────────────────────  Analyse d'un fichier (navigateur)  ─────────────── */

const VERDICT_RANK: Record<IdScanVerdict, number> = { valid: 3, uncertain: 2, invalid: 1 };

function rankResult(r: IdScanResult): number {
  return VERDICT_RANK[r.verdict] * 1000 + r.confidence * 100;
}

/** Texte « lisible » (mots d'au moins 4 lettres) : sert à décider s'il faut tenter des rotations. */
function readableWordCount(text: string): number {
  return (normalizeIdOcr(text).match(/[a-z]{4,}/gi) || []).length;
}

async function ocrCanvases(canvases: HTMLCanvasElement[]): Promise<{ text: string; conf: number }> {
  let text = '';
  let conf = 0;
  for (const canvas of canvases) {
    const ocr = await runOcrOnCanvas(canvas);
    if (ocr.text.trim().length > 0) text += (text ? '\n' : '') + ocr.text;
    conf = Math.max(conf, ocr.confidence);
  }
  return { text, conf };
}

/**
 * Analyse CNI / passeport (profils SN·BF·ML·GN) avec verdict valid|invalid|uncertain.
 *
 * Passes OCR successives (on s'arrête dès qu'un verdict « valid » est obtenu) :
 *   1. image d'origine ; 2. image binarisée (reflets) ; 3. rotations 90/270/180°
 *   (uniquement si le texte est illisible, c'est-à-dire photo probablement de travers).
 */
export async function analyzeIdDocument(
  file: File,
  expected: IdDocKind
): Promise<IdScanResult> {
  const details: string[] = [];

  if (!file) {
    return failResult({ error: 'Aucun fichier.', details });
  }

  const realKind = await detectRealFileKind(file);
  const mimeHint =
    file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
      ? 'pdf'
      : file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name)
        ? 'image'
        : 'other';

  if (realKind === 'unknown' && mimeHint === 'other') {
    return failResult({
      error: 'Format invalide. Photo JPG/PNG/WEBP (ou PDF scanné) de CNI/CNIB ou passeport.',
      details,
    });
  }

  if (realKind === 'unknown' && mimeHint !== 'other') {
    details.push('Avertissement : signature fichier non reconnue — analyse tentée');
  } else {
    details.push(`Type fichier vérifié : ${realKind}`);
  }

  const isPdf = realKind === 'pdf' || (realKind === 'unknown' && mimeHint === 'pdf');

  let canvases: HTMLCanvasElement[] = [];

  try {
    if (isPdf) {
      details.push('PDF détecté — rasterisation des pages pour OCR');
      canvases = await rasterizePdfToCanvases(file, 3);
      if (canvases.length === 0) {
        return failResult({
          error: 'Impossible de lire le PDF. Exportez la page d’identité en photo JPG.',
          details,
        });
      }
    } else {
      const img = await loadImageFromFile(file);
      canvases = [imageToAnalysisCanvas(img)];
      details.push(`Résolution source ${img.width}×${img.height}px`);
    }
  } catch (e) {
    return failResult({
      error: e instanceof Error ? e.message : 'Lecture du document impossible.',
      details,
    });
  }

  const primary = canvases[0];
  let stats: PixelStats;
  try {
    stats = analyzeCanvasPixels(primary);
  } catch (e) {
    return failResult({
      error: e instanceof Error ? e.message : 'Analyse image impossible.',
      details,
    });
  }

  if (stats.width < 320 || stats.height < 220) {
    return failResult({
      confidence: 0.15,
      error: 'Image trop petite. Cadrez la pièce entière, texte lisible.',
      details,
    });
  }

  if (stats.brightness < 18 || stats.brightness > 248) {
    return failResult({
      confidence: 0.2,
      error: UNREADABLE_MESSAGE,
      details,
    });
  }

  // Selfie / portrait sans texte — seuil plus tolérant (les CNI ont une photo)
  if (stats.skinRatio > 0.55 && stats.textLikeRatio < 0.015) {
    return failResult({
      confidence: 0.1,
      error: 'Ce document ne semble pas être une pièce d’identité officielle. Veuillez réessayer.',
      details: [...details, 'Heuristique selfie'],
    });
  }

  // Paysage / texture sans structure texte
  if (stats.textLikeRatio < 0.008 && stats.edgeRatio < 0.04 && stats.variance < 400) {
    return failResult({
      confidence: 0.1,
      error: 'Ce document ne semble pas être une pièce d’identité officielle. Veuillez réessayer.',
      details: [...details, 'Peu de structure texte'],
    });
  }

  details.push('Structure image : OK — lecture OCR…');

  const results: IdScanResult[] = [];

  const consider = (text: string, conf: number, label: string): IdScanResult => {
    const res = decideIdDocumentFromOcr({
      ocrText: text,
      ocrConfidence: conf,
      expected,
      details: [...details, `Passe OCR : ${label} (${conf.toFixed(0)} %, ${text.length} car.)`],
    });
    results.push(res);
    return res;
  };

  const bestResult = (): IdScanResult =>
    results.reduce((a, b) => (rankResult(b) > rankResult(a) ? b : a));

  try {
    // Passe 1 : image d'origine
    const pass1 = await ocrCanvases(canvases);
    const first = consider(pass1.text, pass1.conf, 'originale');
    if (first.verdict === 'valid') return first;

    // Passe 2 : image binarisée
    const pass2 = await ocrCanvases(canvases.map(binarizeCanvas));
    const second = consider(pass2.text, pass2.conf, 'contrastée');
    if (second.verdict === 'valid') return second;

    // Passe 3 : rotations, seulement si le texte est illisible (images uniquement)
    const garbled = readableWordCount(pass1.text) < 12 && readableWordCount(pass2.text) < 12;
    if (!isPdf && garbled) {
      for (const deg of [90, 270, 180] as const) {
        const ocr = await runOcrOnCanvas(rotateCanvas(primary, deg));
        const res = consider(ocr.text, ocr.confidence, `rotation ${deg}°`);
        if (res.verdict === 'valid') return res;
      }
    }
  } catch {
    return failResult({ error: UNREADABLE_MESSAGE, details });
  }

  return results.length > 0
    ? bestResult()
    : failResult({ error: UNREADABLE_MESSAGE, details });
}
