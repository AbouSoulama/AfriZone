export function DocPreview({ url, label }: { url: string | null; label?: string }) {
  if (!url) {
    return (
      <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">
        Aucun document disponible
      </div>
    );
  }

  const lower = url.toLowerCase().split('?')[0];
  const isPdf = lower.endsWith('.pdf');
  const isImage = /\.(png|jpe?g|webp|gif)$/i.test(lower) || url.includes('image');

  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-bold text-gray-500 uppercase">{label}</p>}
      {isPdf ? (
        <iframe title="Document" src={url} className="w-full h-[420px] rounded-xl border" />
      ) : isImage || !isPdf ? (
        <a href={url} target="_blank" rel="noreferrer" className="block">
          <img
            src={url}
            alt="Pièce d'identité"
            className="w-full max-h-[480px] object-contain rounded-xl border bg-gray-50"
          />
        </a>
      ) : null}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-block text-xs font-bold text-[#FF6B00]"
      >
        Ouvrir dans un nouvel onglet →
      </a>
    </div>
  );
}
