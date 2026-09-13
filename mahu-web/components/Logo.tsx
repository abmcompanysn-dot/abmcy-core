/** Logo MAHU — icône "signal de diffusion" (ondes d'info en direct) +
 * wordmark Playfair Display. Couleur héritée de currentColor pour
 * l'icône (s'adapte au thème clair/sombre via le texte parent) sauf le
 * point et l'onde intérieure, toujours en rouge de marque. */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 40 40"
        width="28"
        height="28"
        aria-hidden="true"
        className="shrink-0"
      >
        <circle cx="20" cy="28" r="4" fill="var(--accent-red)" />
        <path
          d="M11 22a12 12 0 0 1 18 0"
          stroke="var(--accent-red)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M5 16a20 20 0 0 1 30 0"
          stroke="var(--accent-red)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
      <span className="font-[family-name:var(--font-display)] text-2xl font-black">
        MAHU
      </span>
    </span>
  );
}
