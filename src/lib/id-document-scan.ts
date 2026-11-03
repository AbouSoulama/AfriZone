import { createWorker, type Worker } from 'tesseract.js';
import {
  bestProfilesFor,
  normalizeIdOcr,
  scoreProfile,
  ALL_ID_PROFILES,
  type IdCountryCode,
  type IdDocKind,
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

/** Rasterise les 1ères pages d’un PDF scanné (passeport multi-pages). */
async function rasterizePdfToCanvases(file: File, maxPages = 4): Promise<HTMLCanvasElement[]> {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const canvases: HTMLCanvasElement[] = [];

  // Passeport multi-pages : page d’identité souvent ~2–4 (pas la couverture)
  const pageIndexes: number[] = [];
  if (doc.numPages <= 2) {
    for (let i = 1; i <= doc.numPages; i++) pageIndexes.push(i);
  } else {
    // Couverture + biodata typiques
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

function imageToAnalysisCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible.');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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

/**
 * Analyse stricte basée sur profils de documents réels (CNIB / passeports AfriZone).
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

  if (!isPdf && !isImage) {
    return {
      ok: false,
      detectedKind: null,
      detectedCountry: null,
      confidence: 0,
      error: 'Format invalide. Photo JPG/PNG/WEBP (ou PDF scanné) de CNI/CNIB ou passeport.',
      details,
    };
  }

  let canvases: HTMLCanvasElement[] = [];

  try {
    if (isPdf) {
      details.push('PDF détecté — rasterisation des pages pour OCR');
      canvases = await rasterizePdfToCanvases(file, 3);
      if (canvases.length === 0) {
        return {
          ok: false,
          detectedKind: null,
          detectedCountry: null,
          confidence: 0,
          error: 'Impossible de lire le PDF. Exportez la page d’identité en photo JPG.',
          details,
        };
      }
    } else {
      const img = await loadImageFromFile(file);
      canvases = [imageToAnalysisCanvas(img)];
      details.push(`Résolution source ${img.width}×${img.height}px`);
    }
  } catch (e) {
    return {
      ok: false,
      detectedKind: null,
      detectedCountry: null,
      confidence: 0,
      error: e instanceof Error ? e.message : 'Lecture du document impossible.',
      details,
    };
  }

  // Qualité : on tolère davantage si l’OCR trouvera des marqueurs forts
  const primary = canvases[0];
  let stats: PixelStats;
  try {
    stats = analyzeCanvasPixels(primary);
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

  if (stats.width < 400 || stats.height < 280) {
    return {
      ok: false,
      detectedKind: null,
      detectedCountry: null,
      confidence: 0.15,
      error: 'Image trop petite. Cadrez la pièce entière, texte lisible.',
      details,
    };
  }

  if (stats.brightness < 25 || stats.brightness > 250) {
    return {
      ok: false,
      detectedKind: null,
      detectedCountry: null,
      confidence: 0.2,
      error: 'Éclairage insuffisant ou surexposé. Reprenez la photo à plat.',
      details,
    };
  }

  // Selfie pur (beaucoup de peau, quasi aucun texte) — les CNI ont une photo mais aussi du texte
  if (stats.skinRatio > 0.42 && stats.textLikeRatio < 0.025) {
    return {
      ok: false,
      detectedKind: null,
      detectedCountry: null,
      confidence: 0.1,
      error: 'Photo de personne détectée, pas une pièce d’identité. Photographiez la CNI/CNIB ou le passeport.',
      details,
    };
  }

  details.push('Structure image : OK — lecture OCR…');

  // OCR sur toutes les pages rasterisées (PDF passeport multi-pages)
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
    return {
      ok: false,
      detectedKind: null,
      detectedCountry: null,
      confidence: 0,
      error: 'Échec OCR. Photo plus nette de la CNI/CNIB ou de la page d’identité du passeport.',
      details,
    };
  }

  details.push(`OCR ${(bestConf || 0).toFixed(0)} % · ${ocrText.length} caractères`);

  if (ocrText.length < 25) {
    return {
      ok: false,
      detectedKind: null,
      detectedCountry: null,
      confidence: 0.15,
      error:
        'Texte illisible. Pour un passeport, photographiez la page avec photo + MRZ. Pour une CNIB, le recto entier.',
      details,
    };
  }

  // Scoring profils attendus vs opposés
  const expectedRanking = bestProfilesFor(ocrText, expected);
  const oppositeRanking = bestProfilesFor(ocrText, oppositeKind(expected));
  const bestExpected = expectedRanking[0];
  const bestOpposite = oppositeRanking[0];

  details.push(
    `Meilleur profil ${expected}: ${bestExpected?.profile.label ?? '—'} (${bestExpected?.score ?? 0})`
  );
  if (bestOpposite && bestOpposite.score > 0) {
    details.push(
      `Profil opposé: ${bestOpposite.profile.label} (${bestOpposite.score})`
    );
  }

  // Refus croisé strict : si le type opposé score nettement mieux
  if (
    bestOpposite &&
    bestOpposite.score >= (bestOpposite.profile.minScore - 5) &&
    bestOpposite.score > (bestExpected?.score ?? 0) + 8
  ) {
    return {
      ok: false,
      detectedKind: oppositeKind(expected),
      detectedCountry: bestOpposite.profile.country,
      confidence: Math.min(0.9, bestOpposite.score / 100),
      error:
        expected === 'cni'
          ? `Un passeport (${COUNTRY_LABEL[bestOpposite.profile.country]}) a été détecté, pas une CNI/CNIB. Sélectionnez « Passeport ».`
          : `Une CNI/CNIB (${COUNTRY_LABEL[bestOpposite.profile.country]}) a été détectée, pas un passeport. Sélectionnez « CNI ».`,
      details: [
        ...details,
        `Signaux: ${bestOpposite.matched.slice(0, 8).join(', ')}`,
      ],
    };
  }

  if (!bestExpected || bestExpected.score < bestExpected.profile.minScore) {
    // Peut-être mauvais pays / document non AfriZone
    const anyBest = ALL_ID_PROFILES.map((p) => ({
      profile: p,
      ...scoreProfile(ocrText, p),
    })).sort((a, b) => b.score - a.score)[0];

    if (anyBest && anyBest.score >= anyBest.profile.minScore && anyBest.profile.kind !== expected) {
      return {
        ok: false,
        detectedKind: anyBest.profile.kind,
        detectedCountry: anyBest.profile.country,
        confidence: Math.min(0.9, anyBest.score / 100),
        error:
          anyBest.profile.kind === 'passport'
            ? 'Passeport détecté. Sélectionnez le type « Passeport ».'
            : 'CNI/CNIB détectée. Sélectionnez le type « CNI ».',
        details: [...details, `Profil: ${anyBest.profile.label} (${anyBest.score})`],
      };
    }

    return {
      ok: false,
      detectedKind: bestExpected?.profile.kind ?? null,
      detectedCountry: bestExpected?.profile.country ?? null,
      confidence: Math.min(0.5, (bestExpected?.score ?? 0) / 100),
      error:
        expected === 'cni'
          ? 'CNI/CNIB non reconnue (SN, BF, ML, GN). Cadrez le recto : « CARTE NATIONALE D’IDENTITÉ… », nom, prénoms, dates.'
          : 'Passeport non reconnu (SN, BF, ML, GN). Cadrez la page d’identité : PASSEPORT, code pays, MRZ en bas.',
      details: [
        ...details,
        `Score ${bestExpected?.score ?? 0}/${bestExpected?.profile.minScore ?? 50}`,
        bestExpected ? `Signaux: ${bestExpected.matched.join(', ') || 'aucun'}` : '',
      ].filter(Boolean),
    };
  }

  // Exiger au moins un signal « type » fort selon le profil
  const strongTypeOk =
    expected === 'cni'
      ? bestExpected.matched.some((id) =>
          /header|cnib|carte|mrz-i|mrz-bfa|mrz-sen|mrz-mli|mrz-gin|cni/i.test(id)
        )
      : bestExpected.matched.some((id) =>
          /passeport|passport|mrz-p|mrz-pp|passport-no|type-p/i.test(id)
        );

  if (!strongTypeOk) {
    return {
      ok: false,
      detectedKind: null,
      detectedCountry: bestExpected.profile.country,
      confidence: 0.3,
      error:
        expected === 'cni'
          ? 'Mentions CNI/CNIB insuffisantes. Le document ne correspond pas à une carte d’identité.'
          : 'Mentions passeport / MRZ insuffisantes. Photographiez la page d’identité du passeport.',
      details,
    };
  }

  const confidence = Math.min(0.97, 0.45 + bestExpected.score / 200 + bestConf / 400);
  details.push(
    `Validé · ${bestExpected.profile.label} · signaux: ${bestExpected.matched.slice(0, 10).join(', ')}`
  );

  return {
    ok: true,
    detectedKind: expected,
    detectedCountry: bestExpected.profile.country,
    confidence,
    details,
  };
}
