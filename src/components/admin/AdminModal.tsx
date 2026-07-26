import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export default function AdminModal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        className={`relative bg-white w-full ${
          wide ? 'max-w-4xl' : 'max-w-2xl'
        } max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b bg-white">
          <h2 className="font-extrabold text-[#1F2937] text-lg">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border flex items-center justify-center hover:bg-gray-50"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
