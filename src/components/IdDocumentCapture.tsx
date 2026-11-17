import { useRef } from 'react';
import { Camera, ImagePlus, Lightbulb } from 'lucide-react';
import type { IdDocKind } from '../lib/id-document-scan';

interface IdDocumentCaptureProps {
  kind: IdDocKind;
  /** Un document est déjà choisi : affiche les boutons compacts « Reprendre / Remplacer ». */
  hasFile: boolean;
  disabled?: boolean;
  onSelect: (file: File) => void;
}

/**
 * Sélection de la pièce d'identité :
 *  - « Prendre une photo » ouvre directement l'appareil photo arrière du téléphone
 *    (`capture="environment"`) ; sur ordinateur, ouvre le sélecteur de fichiers ;
 *  - « Choisir un fichier » : galerie / fichier / PDF scanné.
 */
export function IdDocumentCapture({ kind, hasFile, disabled, onSelect }: IdDocumentCaptureProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const label = kind === 'passport' ? 'passeport' : 'CNI';

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Permet de re-sélectionner le même fichier / refaire la même photo
    e.target.value = '';
    if (file) onSelect(file);
  };

  return (
    <div>
      {/* Appareil photo : caméra arrière directement sur mobile */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handle}
        disabled={disabled}
      />
      {/* Galerie / fichier / PDF */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
        className="hidden"
        onChange={handle}
        disabled={disabled}
      />

      {hasFile ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => cameraRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF6B00] hover:underline disabled:opacity-50"
          >
            <Camera size={14} /> Reprendre une photo
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF6B00] hover:underline disabled:opacity-50"
          >
            <ImagePlus size={14} /> Remplacer par un fichier
          </button>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              disabled={disabled}
              onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-[#FF6B00] bg-orange-50 px-4 py-5 text-center transition-colors hover:bg-orange-100 disabled:opacity-50"
            >
              <Camera size={28} className="text-[#FF6B00]" />
              <span className="text-sm font-bold text-[#1F2937]">
                Prendre en photo mon {label}
              </span>
              <span className="text-xs text-gray-500">Ouvre l’appareil photo du téléphone</span>
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white px-4 py-5 text-center transition-colors hover:border-[#FF6B00] disabled:opacity-50"
            >
              <ImagePlus size={28} className="text-gray-500" />
              <span className="text-sm font-bold text-[#1F2937]">Choisir une image ou un PDF</span>
              <span className="text-xs text-gray-500">Galerie ou fichier — max 8 Mo</span>
            </button>
          </div>

          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-xs text-amber-900">
            <p className="mb-1 flex items-center gap-1.5 font-bold">
              <Lightbulb size={13} /> Pour une photo acceptée du premier coup
            </p>
            <ul className="list-disc space-y-0.5 pl-5">
              <li>Posez la pièce à plat sur une table, en plein jour, sans reflet ni flash.</li>
              {kind === 'passport' ? (
                <li>
                  Cadrez la <strong>page d’identité entière</strong> : photo, état civil et les{' '}
                  <strong>2 lignes de caractères « &lt;&lt;&lt; » en bas</strong>.
                </li>
              ) : (
                <li>
                  Cadrez le <strong>recto entier</strong> (en-tête, photo, nom, prénoms, dates), ou
                  le verso avec les lignes « &lt;&lt;&lt; ».
                </li>
              )}
              <li>Le texte doit être net, la pièce entière dans le cadre, sans doigt dessus.</li>
              <li>Seule une pièce <strong>originale et en cours de validité</strong> est acceptée.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
