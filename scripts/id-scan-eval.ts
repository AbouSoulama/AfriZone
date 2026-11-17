/**
 * Banc d'essai du scanner CNI / passeport (hors navigateur).
 *
 * Usage :
 *   npx tsx scripts/id-scan-eval.ts <cni|passport> <image> [<image> ...]
 *
 * Lance Tesseract (fra+eng) sur chaque image puis applique exactement la même
 * décision que l'application (`decideIdDocumentFromOcr`). Sert à vérifier
 * qu'un vrai document passe et qu'un autre document / un mauvais type est refusé.
 * Aucune image ni donnée personnelle n'est écrite par ce script.
 */
import { createWorker } from 'tesseract.js';
import { decideIdDocumentFromOcr } from '../src/lib/id-document-scan';
import type { IdDocKind } from '../src/lib/id-doc-profiles';

async function main() {
  const [kindArg, ...files] = process.argv.slice(2);
  if ((kindArg !== 'cni' && kindArg !== 'passport') || files.length === 0) {
    console.error('Usage: npx tsx scripts/id-scan-eval.ts <cni|passport> <image> [...]');
    process.exit(1);
  }
  const expected = kindArg as IdDocKind;
  const worker = await createWorker('fra+eng');

  for (const file of files) {
    const { data } = await worker.recognize(file);
    const result = decideIdDocumentFromOcr({
      ocrText: data.text || '',
      ocrConfidence: data.confidence ?? 0,
      expected,
    });
    console.log('\n──────────────────────────────────────────');
    console.log(`Fichier  : ${file}`);
    console.log(`Attendu  : ${expected}`);
    console.log(`Verdict  : ${result.verdict.toUpperCase()}  (ok=${result.ok})`);
    console.log(`Détecté  : ${result.detectedKind ?? '—'} / ${result.detectedCountry ?? '—'}`);
    console.log(`Message  : ${result.message ?? result.error ?? ''}`);
    for (const d of result.details) console.log(`  · ${d}`);
    if (process.env.SHOW_OCR) console.log(`--- OCR ---\n${data.text}\n-----------`);
  }

  await worker.terminate();
}

void main();
