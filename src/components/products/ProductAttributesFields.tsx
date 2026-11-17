import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  attributesForCategory,
  colorSwatchHex,
  type AttributeDef,
  type ProductAttributes,
} from '../../lib/catalog-config';

interface ProductAttributesFieldsProps {
  category: string;
  values: ProductAttributes;
  onChange: (next: ProductAttributes) => void;
}

const inputClass =
  'w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white focus:border-[#FF6B00] focus:outline-none';

function Swatch({ name }: { name: string }) {
  const hex = colorSwatchHex(name);
  if (!hex) return null;
  return (
    <span
      className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-black/15"
      style={{ background: hex }}
    />
  );
}

/** Champ à valeurs multiples : cases à cocher prédéfinies + valeurs libres. */
function MultiField({
  def,
  value,
  onChange,
}: {
  def: AttributeDef;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const options = def.options ?? [];
  const customValues = value.filter((v) => !options.includes(v));

  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const addDraft = () => {
    const parts = draft
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) return;
    onChange([...new Set([...value, ...parts])]);
    setDraft('');
  };

  const chip = (selected: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-bold transition-colors ${
      selected
        ? 'border-[#FF6B00] bg-orange-50 text-[#FF6B00]'
        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
    }`;

  return (
    <div>
      {options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => toggle(o)}
              className={chip(value.includes(o))}
              aria-pressed={value.includes(o)}
            >
              {def.swatches && <Swatch name={o} />}
              {o}
            </button>
          ))}
        </div>
      )}

      {customValues.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {customValues.map((v) => (
            <span key={v} className={chip(true)}>
              {def.swatches && <Swatch name={v} />}
              {v}
              <button
                type="button"
                onClick={() => toggle(v)}
                aria-label={`Retirer ${v}`}
                className="rounded-full hover:bg-orange-100"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {def.allowCustom && (
        <div className="mt-2 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addDraft();
              }
            }}
            placeholder={def.placeholder || 'Ajouter une valeur…'}
            className={`${inputClass} py-2 text-sm`}
          />
          <button
            type="button"
            onClick={addDraft}
            disabled={!draft.trim()}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl border-2 border-gray-200 px-3 text-sm font-bold text-[#1F2937] hover:border-[#FF6B00] disabled:opacity-40"
          >
            <Plus size={14} /> Ajouter
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Champs de la fiche produit propres à la catégorie choisie :
 * marque, modèle, type, tailles, couleurs, pointures, matière, stockage, etc.
 */
export default function ProductAttributesFields({
  category,
  values,
  onChange,
}: ProductAttributesFieldsProps) {
  const defs = attributesForCategory(category);

  const set = (key: string, v: string | string[]) => onChange({ ...values, [key]: v });

  const simple = defs.filter((d) => d.type !== 'multi' && d.type !== 'textarea');
  const wide = defs.filter((d) => d.type === 'multi' || d.type === 'textarea');

  return (
    <div className="space-y-5 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
      <div>
        <p className="text-sm font-extrabold text-[#1F2937]">
          Caractéristiques — {category}
        </p>
        <p className="text-xs text-gray-500">
          Plus la fiche est précise (marque, tailles, couleurs…), plus le produit est facile à
          trouver et à acheter.
        </p>
      </div>

      {simple.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {simple.map((def) => {
            const raw = values[def.key];
            const value = Array.isArray(raw) ? raw.join(', ') : (raw ?? '');
            return (
              <div key={def.key}>
                <label className="mb-2 block text-sm font-bold">{def.label}</label>
                {def.type === 'select' ? (
                  <select
                    value={value}
                    onChange={(e) => set(def.key, e.target.value)}
                    className={inputClass}
                  >
                    <option value="">— Non précisé —</option>
                    {(def.options ?? []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={def.type === 'number' ? 'number' : def.type === 'date' ? 'date' : 'text'}
                    min={def.type === 'number' ? 0 : undefined}
                    value={value}
                    onChange={(e) => set(def.key, e.target.value)}
                    placeholder={def.placeholder}
                    className={inputClass}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {wide.map((def) => {
        const raw = values[def.key];
        return (
          <div key={def.key}>
            <label className="mb-1 block text-sm font-bold">{def.label}</label>
            {def.hint && <p className="mb-2 text-xs text-gray-500">{def.hint}</p>}
            {def.type === 'multi' ? (
              <MultiField
                def={def}
                value={Array.isArray(raw) ? raw : raw ? [raw] : []}
                onChange={(next) => set(def.key, next)}
              />
            ) : (
              <textarea
                value={Array.isArray(raw) ? raw.join(', ') : (raw ?? '')}
                onChange={(e) => set(def.key, e.target.value)}
                rows={3}
                placeholder={def.placeholder}
                className={`${inputClass} resize-none`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
