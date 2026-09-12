/** Petit indicateur de chargement réutilisable — remplace les textes
 * "Chargement..." isolés par quelque chose de plus visuel. */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Chargement"
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--border-color)] border-t-[var(--accent-red)] ${className}`}
    />
  );
}

/** Bloc de chargement pleine largeur, même style que les états vides. */
export function LoadingBlock({ label = "Chargement..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-10 text-center text-sm text-[var(--text-muted)]">
      <Spinner />
      {label}
    </div>
  );
}
