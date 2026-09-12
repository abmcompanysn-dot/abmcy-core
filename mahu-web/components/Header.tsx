"use client";

import Link from "next/link";
import { useState } from "react";

const CATEGORIES = ["Politique", "Économie", "Tech", "Sport", "Culture"];

// Lu une seule fois à l'initialisation de l'état (pas dans un useEffect,
// que react-hooks/set-state-in-effect déconseille pour ce cas) — le script
// inline de app/layout.tsx a déjà posé data-theme sur <html> avant
// l'hydratation, donc ce state ne fait que suivre ce qui est déjà affiché.
function initialTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem("mahu-theme");
    return stored === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export default function Header() {
  const [theme, setTheme] = useState<"dark" | "light">(initialTheme);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    if (next === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      window.localStorage.setItem("mahu-theme", next);
    } catch {
      // localStorage indisponible — on ignore, le thème reste en mémoire.
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/95 backdrop-blur">
      <nav className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-4 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-[family-name:var(--font-display)] text-2xl font-black text-[var(--text-main)] no-underline"
        >
          MAHU
          <span className="block h-1.5 w-10 bg-[var(--accent-red)]" />
        </Link>

        <div className="hidden items-center gap-5 md:flex">
          <Link
            href="/"
            className="text-xs font-semibold tracking-wide text-[var(--text-main)] uppercase no-underline hover:text-[var(--accent-red)]"
          >
            Accueil
          </Link>
          {CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={`/?category=${encodeURIComponent(cat)}`}
              className="text-xs font-semibold tracking-wide text-[var(--text-main)] uppercase no-underline hover:text-[var(--accent-red)]"
            >
              {cat}
            </Link>
          ))}
        </div>

        <button
          onClick={toggleTheme}
          title="Changer de mode"
          aria-label="Changer de thème"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] text-lg hover:border-[var(--accent-red)]"
        >
          🌓
        </button>
      </nav>
    </header>
  );
}
