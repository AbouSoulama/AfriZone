import { useEffect, useRef, useState } from 'react';
import {
  analyzeIdDocument,
  ID_SCAN_STEPS,
  type IdDocKind,
  type IdScanResult,
  type IdScanStepId,
} from '../lib/id-document-scan';

const COUNTRY_LABEL: Record<string, string> = {
  SN: 'Sénégal',
  BF: 'Burkina Faso',
  ML: 'Mali',
  GN: 'Guinée',
};

interface IdDocumentScannerProps {
  file: File | null;
  expectedKind: IdDocKind;
  previewUrl: string | null;
  onComplete: (result: IdScanResult) => void;
}

/**
 * Scanner CNI / Passeport — OCR + pays AfriZone (SN, BF, ML, GN).
 * Verdicts : valid | invalid | uncertain.
 */
export function IdDocumentScanner({
  file,
  expectedKind,
  previewUrl,
  onComplete,
}: IdDocumentScannerProps) {
  const [activeStep, setActiveStep] = useState<IdScanStepId | null>(null);
  const [completed, setCompleted] = useState<Set<IdScanStepId>>(new Set());
  const [result, setResult] = useState<IdScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const runId = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!file) {
      setActiveStep(null);
      setCompleted(new Set());
      setResult(null);
      setScanning(false);
      return;
    }

    const id = ++runId.current;
    let cancelled = false;

    async function run() {
      setScanning(true);
      setResult(null);
      setCompleted(new Set());
      setActiveStep(null);

      const stepDelay = (ms: number) =>
        new Promise<void>((r) => setTimeout(r, ms));

      const analysisPromise = analyzeIdDocument(file!, expectedKind);

      for (const step of ID_SCAN_STEPS) {
        if (cancelled || runId.current !== id) return;
        if (step.id === 'done') continue;
        setActiveStep(step.id);
        const wait =
          step.id === 'ocr' ? 1600 : step.id === 'authenticity' || step.id === 'country' ? 900 : 550;
        await stepDelay(wait);
        if (cancelled || runId.current !== id) return;
        setCompleted((prev) => new Set(prev).add(step.id));
      }

      setActiveStep('ocr');
      const analysis = await analysisPromise;
      if (cancelled || runId.current !== id) return;

      setActiveStep('done');
      setCompleted((prev) => new Set(prev).add('done'));
      setResult(analysis);
      setScanning(false);
      onCompleteRef.current(analysis);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [file, expectedKind]);

  if (!file) return null;

  const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name);

  const bannerClass =
    result?.verdict === 'valid'
      ? 'bg-emerald-500/90 text-white'
      : result?.verdict === 'uncertain'
        ? 'bg-amber-500/90 text-white'
        : 'bg-red-500/90 text-white';

  const bannerText = !result
    ? ''
    : result.verdict === 'valid'
      ? `Validé · ${result.detectedCountry ? COUNTRY_LABEL[result.detectedCountry] : 'pays OK'} · ${
          result.detectedKind === 'passport' ? 'Passeport' : 'CNI'
        }`
      : result.verdict === 'uncertain'
        ? 'Vérification complémentaire requise'
        : 'Document refusé — pièce d’identité invalide';

  const resultBoxClass =
    result?.verdict === 'valid'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
      : result?.verdict === 'uncertain'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-50'
        : 'border-red-500/40 bg-red-500/10 text-red-100';

  const statusDot =
    result?.verdict === 'valid'
      ? 'bg-emerald-400'
      : scanning
        ? 'bg-orange-400'
        : result?.verdict === 'uncertain'
          ? 'bg-amber-400'
          : result
            ? 'bg-red-400'
            : 'bg-slate-500';

  return (
    <div className="id-scanner mt-4 overflow-hidden rounded-2xl border border-orange-200/80 bg-gradient-to-b from-slate-950 to-slate-900 text-white shadow-lg shadow-orange-500/10">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {scanning && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${statusDot}`} />
          </span>
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-200">
            Scanner OCR · CNI / Passeport · SN·BF·ML·GN
          </p>
        </div>
        <p className="text-[10px] text-slate-400">
          Type : {expectedKind === 'cni' ? 'CNI' : 'Passeport'}
        </p>
      </div>

      <div className="grid gap-0 sm:grid-cols-[1.1fr_0.9fr]">
        <div className="relative min-h-[200px] bg-black/40">
          {isImage && previewUrl ? (
            <img
              src={previewUrl}
              alt="Document à scanner"
              className="h-full max-h-[280px] w-full object-contain"
            />
          ) : (
            <div className="flex h-[200px] flex-col items-center justify-center gap-2 px-4 text-center">
              <p className="text-xs text-slate-400">
                Photo JPG/PNG/WEBP requise pour la vérification OCR
              </p>
            </div>
          )}

          <div className="pointer-events-none absolute inset-3 rounded-lg border border-orange-400/40 shadow-[inset_0_0_40px_rgba(249,115,22,0.15)]">
            <span className="absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-orange-400" />
            <span className="absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-orange-400" />
            <span className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-orange-400" />
            <span className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-orange-400" />
          </div>
          {scanning && (
            <div className="id-scanner-beam pointer-events-none absolute inset-x-4 top-4 bottom-4 overflow-hidden rounded">
              <div className="id-scanner-beam-line" />
            </div>
          )}
          {result && !scanning && (
            <div className={`absolute inset-x-0 bottom-0 px-3 py-2 text-center text-xs font-semibold ${bannerClass}`}>
              {bannerText}
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-white/10 p-4 sm:border-l sm:border-t-0">
          <ul className="space-y-2">
            {ID_SCAN_STEPS.map((step) => {
              const done = completed.has(step.id);
              const active = activeStep === step.id && scanning;
              return (
                <li key={step.id} className="flex items-center gap-2.5 text-xs">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      done
                        ? 'bg-emerald-500 text-white'
                        : active
                          ? 'bg-orange-500 text-white animate-pulse'
                          : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {done ? '✓' : active ? '…' : '·'}
                  </span>
                  <span className={done || active ? 'text-slate-100' : 'text-slate-500'}>
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ul>

          {result && (
            <div className={`rounded-xl border px-3 py-2 text-xs leading-relaxed ${resultBoxClass}`}>
              <p>
                {result.message ||
                  result.error ||
                  (result.verdict === 'valid'
                    ? successFallback(result)
                    : 'Document non validé.')}
                {result.verdict === 'valid' && result.confidence
                  ? ` Confiance ${(result.confidence * 100).toFixed(0)} %.`
                  : ''}
              </p>
              {result.details.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-[10px] opacity-70">
                  {result.details.slice(0, 5).map((d) => (
                    <li key={d}>• {d}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function successFallback(result: IdScanResult): string {
  const country = result.detectedCountry ? COUNTRY_LABEL[result.detectedCountry] : '';
  return result.detectedKind === 'passport'
    ? `Passeport détecté avec succès${country ? ` (${country})` : ''}.`
    : `Carte nationale d'identité détectée avec succès${country ? ` (${country})` : ''}.`;
}
