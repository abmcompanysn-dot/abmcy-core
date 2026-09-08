/** Petit indicateur de chargement réutilisable — remplace les textes
 * "Chargement..." isolés par quelque chose de plus visuel. */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Chargement"
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 ${className}`}
    />
  );
}

/** Bloc de chargement pleine largeur, même style que les états vides déjà
 * utilisés partout (rounded-xl border bg-white p-10 text-center). */
export function LoadingBlock({ label = "Chargement..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
      <Spinner />
      {label}
    </div>
  );
}
