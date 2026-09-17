/** Page affichée à la place de toute la boutique quand le tenant est
 * suspendu côté ABMCY Core — pas de header/footer boutique, juste le
 * message générique ABMCY. */
export function SuspendedNotice() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <span className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
        ABMCY Core
      </span>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-text sm:text-3xl">
        Cette boutique est temporairement indisponible
      </h1>
      <p className="max-w-md text-sm text-text-muted">
        L&apos;accès à ce site a été suspendu par son propriétaire. Si vous
        êtes le propriétaire de cette boutique, contactez ABMCY Core pour
        régulariser votre compte.
      </p>
    </div>
  );
}
