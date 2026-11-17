import { Check } from 'lucide-react';
import { colorSwatchHex, type SelectedOptions, type VariantGroup } from '../../lib/catalog-config';

interface ProductOptionPickerProps {
  groups: VariantGroup[];
  selected: SelectedOptions;
  onChange: (next: SelectedOptions) => void;
  /** Groupes à mettre en évidence (choix manquant au moment de commander). */
  missing?: string[];
}

/** Choix du client sur la fiche produit : taille, couleur, pointure, modèle… */
export default function ProductOptionPicker({
  groups,
  selected,
  onChange,
  missing = [],
}: ProductOptionPickerProps) {
  if (groups.length === 0) return null;

  return (
    <div className="mb-4 space-y-4 rounded-2xl border border-gray-100 bg-white p-4">
      {groups.map((group) => {
        const current = selected[group.label];
        const isMissing = missing.includes(group.label);
        return (
          <div key={group.key}>
            <p className="mb-2 text-sm font-bold text-[#1F2937]">
              {group.label}
              {current ? (
                <span className="ml-2 font-semibold text-[#FF6B00]">{current}</span>
              ) : (
                <span className={`ml-2 text-xs font-semibold ${isMissing ? 'text-red-600' : 'text-gray-400'}`}>
                  {isMissing ? 'à choisir' : 'choisissez une option'}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.values.map((value) => {
                const active = current === value;
                const hex = group.swatches ? colorSwatchHex(value) : null;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      const next = { ...selected };
                      if (active) delete next[group.label];
                      else next[group.label] = value;
                      onChange(next);
                    }}
                    className={`inline-flex min-w-[2.75rem] items-center justify-center gap-1.5 rounded-xl border-2 px-3.5 py-2 text-sm font-bold transition-colors ${
                      active
                        ? 'border-[#FF6B00] bg-orange-50 text-[#FF6B00]'
                        : isMissing
                          ? 'border-red-200 bg-white text-gray-700 hover:border-[#FF6B00]'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {hex && (
                      <span
                        className="inline-block h-4 w-4 shrink-0 rounded-full border border-black/15"
                        style={{ background: hex }}
                      />
                    )}
                    {value}
                    {active && <Check size={14} />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
