import type { SelectedOptions } from '../../lib/catalog-config';
import { colorSwatchHex } from '../../lib/catalog-config';

interface SelectedOptionsChipsProps {
  options: SelectedOptions | null | undefined;
  className?: string;
}

/** Affiche les choix du client : « Taille : M », « Couleur : Noir », « Pointure : 42 »… */
export default function SelectedOptionsChips({ options, className = '' }: SelectedOptionsChipsProps) {
  const entries = Object.entries(options ?? {});
  if (entries.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {entries.map(([label, value]) => {
        const hex = /couleur/i.test(label) ? colorSwatchHex(value) : null;
        return (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-semibold text-gray-700"
          >
            {hex && (
              <span
                className="inline-block h-2.5 w-2.5 rounded-full border border-black/15"
                style={{ background: hex }}
              />
            )}
            <span className="text-gray-400">{label} :</span> {value}
          </span>
        );
      })}
    </div>
  );
}
