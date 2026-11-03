import { useEffect, useRef, useState } from 'react';
import {
  analyzeIdDocument,
  ID_SCAN_STEPS,
  type IdDocKind,
  type IdScanResult,
  type IdScanStepId,
} from '../lib/id-document-scan';

interface IdDocumentScannerProps {
  file: File | null;
  expectedKind: IdDocKind;
  previewUrl: string | null;
  onComplete: (result: IdScanResult) => void;
}

/**
 * Scanner visuel CNI / Passeport — animation + contrôles qualité côté client.
 * La validation finale reste administrative.
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

      for (const step of ID_SCAN_STEPS) {
        if (cancelled || runId.current !== id) return;
        if (step.id === 'done') continue;
        setActiveStep(step.id);
        await stepDelay(step.id === 'authenticity' ? 1100 : 700);
        if (cancelled || runId.current !== id) return;
        setCompleted((prev) => new Set(prev).add(step.id));
      }

      const analysis = await analyzeIdDocument(file!, expectedKind);
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

  return (
    <div className="id-scanner mt-4 overflow-hidden rounded-2xl border border-orange-200/80 bg-gradient-to-b from-slate-950 to-slate-900 text-white shadow-lg shadow-orange-500/10">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {scanning && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                result?.ok ? 'bg-emerald-400' : scanning ? 'bg-orange-400' : result ? 'bg-red-400' : 'bg-slate-500'
              }`}
            />
          </span>
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-200">
            Scanner d’authenticité · CNI / Passeport
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
              <svg className="h-10 w-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="text-xs text-slate-400">Scan PDF en cours…</p>
            </div>
          )}

          {/* Cadre + faisceau */}
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
            <div
              className={`absolute inset-x-0 bottom-0 px-3 py-2 text-center text-xs font-semibold ${
                result.ok
                  ? 'bg-emerald-500/90 text-white'
                  : 'bg-red-500/90 text-white'
              }`}
            >
              {result.ok ? 'Document accepté pour dépôt' : 'Document refusé — recommencez'}
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
            <div
              className={`rounded-xl border px-3 py-2 text-xs leading-relaxed ${
                result.ok
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                  : 'border-red-500/40 bg-red-500/10 text-red-100'
              }`}
            >
              {result.ok ? (
                <p>
                  Contrôles passés
                  {result.confidence
                    ? ` · confiance ${(result.confidence * 100).toFixed(0)} %`
                    : ''}
                  . Un administrateur confirmera l’identité.
                </p>
              ) : (
                <p>{result.error}</p>
              )}
              {result.details.length > 0 && result.ok && (
                <ul className="mt-1.5 space-y-0.5 text-[10px] text-emerald-200/70">
                  {result.details.slice(0, 4).map((d) => (
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
