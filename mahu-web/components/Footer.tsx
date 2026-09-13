import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-[var(--border-color)] bg-black/40 px-4 py-16 sm:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="text-[var(--text-main)]">
          <Logo />
        </div>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
          L&apos;information africaine de référence. Analyse, rigueur et
          réactivité au cœur du continent et du monde entier.
        </p>
        <p className="mt-6 text-xs text-[var(--text-muted)]">
          © {new Date().getFullYear()} MAHU Media Group —{" "}
          <strong className="text-[var(--text-main)]">ABMCY</strong>. Tous
          droits réservés.
        </p>
      </div>
    </footer>
  );
}
