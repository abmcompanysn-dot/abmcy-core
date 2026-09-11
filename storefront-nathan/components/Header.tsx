import Link from "next/link";
import { CartBadge } from "./CartBadge";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-(family-name:--font-display) text-lg font-bold tracking-tight text-text"
        >
          Nathan
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-text-muted sm:flex">
          <Link href="/" className="transition-colors hover:text-text">
            Catalogue
          </Link>
          <Link
            href="/compte"
            className="transition-colors hover:text-text"
          >
            Mon compte
          </Link>
        </nav>

        <CartBadge />
      </div>
    </header>
  );
}
