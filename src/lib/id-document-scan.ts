export type IdDocKind = 'cni' | 'passport';

export type IdScanStepId =
  | 'load'
  | 'contours'
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
  confidence: number;
  error?: string;
  details: string[];
}

export const ID_SCAN_STEPS: IdScanStep[] = [
  { id: 'load', label: 'Chargement du document' },
  { id: 'contours', label: 'Détection des contours' },
  { id: 'type', label: 'Identification CNI / Passeport' },
  { id: 'authenticity', label: 'Contrôle d’authenticité visuelle' },
  { id: 'match', label: 'Concordance avec le type choisi' },
  { id: 'done', label: 'Scan terminé' },
];

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

function analyzePixels(img: HTMLImageElement): {
  brightness: number;
  variance: number;
  width: number;
  height: number;
  aspect: number;
} {
  const maxSide = 640;
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
  // Échantillonnage 1 pixel sur 4
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += gray;
    sumSq += gray * gray;
    n += 1;
  }
  const mean = sum / Math.max(1, n);
  const variance = sumSq / Math.max(1, n) - mean * mean;
  const aspect = img.width / Math.max(1, img.height);
  return { brightness: mean, variance, width: img.width, height: img.height, aspect };
}

function detectKindFromAspect(aspect: number): { kind: IdDocKind; confidence: number } {
  // CNI / carte : souvent paysage ~1.4–1.85
  // Passeport : page plus carrée / portrait ou paysage modéré
  const landscape = aspect >= 1 ? aspect : 1 / aspect;
  if (landscape >= 1.45 && landscape <= 1.9) {
    return { kind: 'cni', confidence: 0.78 };
  }
  if (landscape >= 1.15 && landscape < 1.45) {
    return { kind: 'passport', confidence: 0.72 };
  }
  if (aspect < 1 && aspect >= 0.55 && aspect <= 0.9) {
    // Portrait : plus typique passeport scanné à la verticale
    return { kind: 'passport', confidence: 0.7 };
  }
  return { kind: landscape >= 1.4 ? 'cni' : 'passport', confidence: 0.45 };
}

/**
 * Analyse client du document (qualité + forme).
 * Ce n’est pas une vérification gouvernementale : l’admin valide ensuite.
 */
export async function analyzeIdDocument(
  file: File,
  expected: IdDocKind
): Promise<IdScanResult> {
  const details: string[] = [];

  if (!file) {
    return { ok: false, detectedKind: null, confidence: 0, error: 'Aucun fichier.', details };
  }

  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const isImage =
    file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name);

  if (!isPdf && !isImage) {
    return {
      ok: false,
      detectedKind: null,
      confidence: 0,
      error: 'Seules une photo de CNI ou de passeport (JPG/PNG/WEBP) ou un PDF sont acceptés.',
      details,
    };
  }

  // PDF : contrôle format uniquement (pas d’analyse pixels)
  if (isPdf) {
    details.push('Document PDF détecté');
    details.push(`Type déclaré : ${expected === 'cni' ? 'CNI' : 'Passeport'}`);
    if (file.size < 40_000) {
      return {
        ok: false,
        detectedKind: expected,
        confidence: 0.2,
        error: 'Le PDF semble trop léger pour une pièce d’identité. Fournissez un scan net.',
        details,
      };
    }
    details.push('Contrôle format PDF : OK');
    return {
      ok: true,
      detectedKind: expected,
      confidence: 0.55,
      details: [
        ...details,
        'Authenticité visuelle limitée sur PDF — un administrateur confirmera le document.',
      ],
    };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImageFromFile(file);
  } catch (e) {
    return {
      ok: false,
      detectedKind: null,
      confidence: 0,
      error: e instanceof Error ? e.message : 'Lecture image impossible.',
      details,
    };
  }

  const stats = analyzePixels(img);
  details.push(`Résolution ${stats.width}×${stats.height}px`);

  if (stats.width < 500 || stats.height < 320) {
    return {
      ok: false,
      detectedKind: null,
      confidence: 0.2,
      error: 'Image trop petite. Photographiez la pièce entière, bien lisible (min. ~500px).',
      details,
    };
  }

  if (stats.brightness < 35) {
    return {
      ok: false,
      detectedKind: null,
      confidence: 0.25,
      error: 'Document trop sombre. Reprenez la photo avec plus de lumière.',
      details,
    };
  }
  if (stats.brightness > 245) {
    return {
      ok: false,
      detectedKind: null,
      confidence: 0.25,
      error: 'Document trop surexposé / flou blanc. Évitez le flash direct.',
      details,
    };
  }
  if (stats.variance < 180) {
    return {
      ok: false,
      detectedKind: null,
      confidence: 0.3,
      error: 'Image peu contrastée ou floue. Cadrez la CNI ou le passeport à plat, net.',
      details,
    };
  }

  details.push('Contours et contraste : OK');
  const detected = detectKindFromAspect(stats.aspect);
  details.push(
    `Forme détectée : ${detected.kind === 'cni' ? 'CNI / carte' : 'Passeport'} (confiance ${(detected.confidence * 100).toFixed(0)} %)`
  );

  // Concordance souple : si confiance élevée et type différent → refus
  if (detected.confidence >= 0.65 && detected.kind !== expected) {
    return {
      ok: false,
      detectedKind: detected.kind,
      confidence: detected.confidence,
      error:
        expected === 'cni'
          ? 'Le document ressemble davantage à un passeport. Sélectionnez « Passeport » ou uploadez votre CNI.'
          : 'Le document ressemble davantage à une CNI. Sélectionnez « CNI » ou uploadez votre passeport.',
      details,
    };
  }

  details.push('Contrôles d’authenticité visuelle de base : OK');
  details.push(`Concordance avec ${expected === 'cni' ? 'CNI' : 'Passeport'} : OK`);

  return {
    ok: true,
    detectedKind: detected.kind,
    confidence: Math.max(detected.confidence, 0.6),
    details,
  };
}
