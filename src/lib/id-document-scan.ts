import { createWorker, type Worker } from 'tesseract.js';
import {
  bestProfilesFor,
  normalizeIdOcr,
  scoreProfile,
  scoreSignals,
  ALL_ID_PROFILES,
  GENERIC_ID_SIGNALS,
  hasStrongTypeSignal,
  type IdCountryCode,
  type IdDocKind,
  type IdDocProfile,
} from './id-doc-profiles';

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
  const maxSide = 1400;
  const minSide = 900;
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

async function runOcrOnCanvas(canvas: HTMLCanvasElement): Promise<{ text: string; confidence: number }> {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(canvas);
  return {
    text: normalizeIdOcr(data.text || ''),
    confidence: data.confidence ?? 0,
  };
}

function oppositeKind(kind: IdDocKind): IdDocKind {
  return kind === 'cni' ? 'passport' : 'cni';
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
  ocrText: string;
  ocrConfidence: number;
  expected: IdDocKind;
  details?: string[];
}

/**
 * Décision pure à partir du texte OCR — testable sans DOM.
 * Retourne valid / invalid / uncertain.
 */
export function decideIdDocumentFromOcr(input: OcrDecisionInput): IdScanResult {
  const details = [...(input.details ?? [])];
  const text = normalizeIdOcr(input.ocrText);
  const expected = input.expected;
  const ocrConf = input.ocrConfidence;

  if (text.length < 12) {
    return failResult({
      confidence: 0.12,
      error:
        'Nous n’avons pas pu lire correctement votre document. Veuillez prendre une nouvelle photo dans un endroit bien éclairé.',
      details: [...details, `OCR trop court (${text.length} car.)`],
    });
  }

  const expectedRanking = bestProfilesFor(text, expected);
  const oppositeRanking = bestProfilesFor(text, oppositeKind(expected));
  const bestExpected = expectedRanking[0];
  const bestOpposite = oppositeRanking[0];
  const generic = scoreSignals(text, GENERIC_ID_SIGNALS);

  details.push(
    `Meilleur profil ${expected}: ${bestExpected?.profile.label ?? '—'} (${bestExpected?.score ?? 0})`
  );
  if (bestOpposite && bestOpposite.score > 0) {
    details.push(`Profil opposé: ${bestOpposite.profile.label} (${bestOpposite.score})`);
  }
  if (generic.score > 0) {
    details.push(`Signaux génériques: ${generic.matched.join(', ')} (${generic.score})`);
  }

  const oppositeStrong =
    bestOpposite &&
    hasStrongTypeSignal(oppositeKind(expected), bestOpposite.matched) &&
    bestOpposite.score >= bestOpposite.profile.softScore;

  // Type croisé clair → invalid (pas uncertain)
  if (
    oppositeStrong &&
    bestOpposite.score >= (bestOpposite.profile.minScore - 8) &&
    bestOpposite.score > (bestExpected?.score ?? 0) + 12
  ) {
    return failResult({
      detectedKind: oppositeKind(expected),
      detectedCountry: bestOpposite.profile.country,
      confidence: Math.min(0.9, bestOpposite.score / 100),
      error: 'Le document détecté ne correspond pas au type sélectionné.',
      details: [
        ...details,
        `Signaux: ${bestOpposite.matched.slice(0, 8).join(', ')}`,
      ],
    });
  }

  // Autre profil AfriZone du mauvais type qui passe minScore
  const anyBest = ALL_ID_PROFILES.map((p) => ({
    profile: p,
    ...scoreProfile(text, p),
  })).sort((a, b) => b.score - a.score)[0] as
    | { profile: IdDocProfile; score: number; matched: string[] }
    | undefined;

  if (
    anyBest &&
    anyBest.score >= anyBest.profile.minScore &&
    anyBest.profile.kind !== expected &&
    hasStrongTypeSignal(anyBest.profile.kind, anyBest.matched) &&
    anyBest.score > (bestExpected?.score ?? 0) + 8
  ) {
    return failResult({
      detectedKind: anyBest.profile.kind,
      detectedCountry: anyBest.profile.country,
      confidence: Math.min(0.9, anyBest.score / 100),
      error: 'Le document détecté ne correspond pas au type sélectionné.',
      details: [...details, `Profil: ${anyBest.profile.label} (${anyBest.score})`],
    });
  }

  if (!bestExpected) {
    return failResult({
      confidence: 0.1,
      error: 'Ce document ne semble pas être une pièce d’identité officielle. Veuillez réessayer.',
      details,
    });
  }

  const { profile, score, matched } = bestExpected;
  const strongType = hasStrongTypeSignal(expected, matched);
  const confidence = Math.min(0.97, 0.4 + score / 180 + ocrConf / 500);

  const authorizedCountry =
    matched.some((id) =>
      /burkina|senegal|mali|guinee|bfa|sen|mli|gin|cnib|republique-(senegal|mali|guinee)/i.test(
        id
      )
    ) ||
    /(?:burkina\s*faso|\bsenegal\b|\bmali\b|\bguinee\b|\bguinea\b|\bbfa\b|\bsen\b|\bmli\b|\bgin\b)/i.test(
      text
    );

  const foreign =
    /\b(france|francaise|belgique|cote\s+d'?ivoire|ivoire|niger|togo|benin|cameroun|maroc|algerie|tunisie|gabon|congo|rwanda|kenya|nigeria|ghana|usa|united\s+states|canada|portugal|espagne|allemagne)\b/i.test(
      text
    ) ||
    /i\s*<\s*(fra|civ|ner|tgo|ben|cmr|mar|dza|tun|gab|cog|rwa|ken|nga|gha|usa|can|prt|esp|deu)/i.test(
      text
    ) ||
    /p\s*<\s*(fra|civ|ner|tgo|ben|cmr|mar|dza|tun|gab|cog|rwa|ken|nga|gha|usa|can|prt|esp|deu)/i.test(
      text
    );

  // Refus pays non autorisé avant toute acceptation soft/uncertain
  if (foreign && !authorizedCountry) {
    return failResult({
      confidence: 0.25,
      error:
        'Ce document ne semble pas provenir d’un pays autorisé (Sénégal, Burkina Faso, Mali, Guinée).',
      details: [...details, `Score ${score}/${profile.minScore}`],
    });
  }

  // Valid : score suffisant + signal de type (ou score très élevé)
  if (score >= profile.minScore && (strongType || score >= profile.minScore + 18)) {
    details.push(`Validé · ${profile.label} · signaux: ${matched.slice(0, 10).join(', ')}`);
    return {
      ok: true,
      verdict: 'valid',
      detectedKind: expected,
      detectedCountry: profile.country,
      confidence,
      message: successMessage(expected, profile.country),
      details,
    };
  }

  // Uncertain : indices d’une vraie pièce mais OCR incomplet
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
    details.push(
      `Incertain · score ${score}/${profile.minScore} (seuil soft ${profile.softScore})`
    );
    return {
      ok: true,
      verdict: 'uncertain',
      detectedKind: expected,
      detectedCountry: profile.country,
      confidence: Math.min(0.55, confidence),
      message:
        'Ce document nécessite une vérification complémentaire. Vous pouvez continuer ; un administrateur vérifiera votre pièce.',
      details,
    };
  }

  if (generic.score < 10 && score < profile.softScore) {
    return failResult({
      detectedKind: null,
      detectedCountry: null,
      confidence: Math.min(0.4, score / 100),
      error: 'Ce document ne semble pas être une pièce d’identité officielle. Veuillez réessayer.',
      details: [
        ...details,
        `Score ${score}/${profile.minScore}`,
        `Signaux: ${matched.join(', ') || 'aucun'}`,
      ],
    });
  }

  // Indices faibles → uncertain plutôt que rejet sec
  if (generic.score >= 10 || score >= 14) {
    details.push(`Incertain (signaux faibles) · score ${score}`);
    return {
      ok: true,
      verdict: 'uncertain',
      detectedKind: expected,
      detectedCountry: score >= profile.softScore ? profile.country : null,
      confidence: 0.35,
      message:
        'Nous n’avons pas pu lire correctement votre document. Vous pouvez reprendre une photo plus nette, ou continuer pour une vérification manuelle.',
      details,
    };
  }

  return failResult({
    detectedKind: bestExpected.profile.kind,
    detectedCountry: bestExpected.profile.country,
    confidence: Math.min(0.45, score / 100),
    error:
      expected === 'cni'
        ? 'CNI/CNIB non reconnue (SN, BF, ML, GN). Cadrez le recto entier, texte lisible.'
        : 'Passeport non reconnu (SN, BF, ML, GN). Cadrez la page d’identité (photo + MRZ).',
    details: [
      ...details,
      `Score ${score}/${profile.minScore}`,
      `Signaux: ${matched.join(', ') || 'aucun'}`,
    ],
  });
}

/**
 * Analyse CNI / passeport (profils SN·BF·ML·GN) avec verdict valid|invalid|uncertain.
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
      error:
        'Nous n’avons pas pu lire correctement votre document. Veuillez prendre une nouvelle photo dans un endroit bien éclairé.',
      details,
    });
  }

  // Selfie / portrait sans texte — seuil plus tolérant (CNI ont une photo)
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

  let ocrText = '';
  let bestConf = 0;
  try {
    for (let i = 0; i < canvases.length; i++) {
      const ocr = await runOcrOnCanvas(canvases[i]);
      if (ocr.text.length > 0) {
        ocrText += (ocrText ? '\n' : '') + ocr.text;
      }
      bestConf = Math.max(bestConf, ocr.confidence);
    }
  } catch {
    return failResult({
      error:
        'Nous n’avons pas pu lire correctement votre document. Veuillez prendre une nouvelle photo dans un endroit bien éclairé.',
      details,
    });
  }

  details.push(`OCR ${(bestConf || 0).toFixed(0)} % · ${ocrText.length} caractères`);

  return decideIdDocumentFromOcr({
    ocrText,
    ocrConfidence: bestConf,
    expected,
    details,
  });
}
