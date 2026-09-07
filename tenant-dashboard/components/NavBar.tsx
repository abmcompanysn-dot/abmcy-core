"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useFeatures } from "@/lib/features-context";
import { DOCS_URL } from "@/lib/api";

const baseLinks = [{ href: "/", label: "Commandes" }];

// Ces onglets dépendent du feature flag catalog_enabled (voir GET
// /features) : un tenant qui n'a pas le catalogue activé ne doit pas
// pouvoir y accéder, pour éviter de cliquer dans le vide sur des routes
// qui renvoient 403 catalog_not_enabled.
const catalogLinks = [
  { href: "/catalogue", label: "Catalogue" },
  { href: "/tissus", label: "Tissus" },
  { href: "/galerie", label: "Galerie" },
  { href: "/avis", label: "Avis" },
];

const trailingLinks = [
  { href: "/photos", label: "Photos" },
  { href: "/parametres", label: "Paramètres" },
];

export function NavBar() {
  const { apiKey, logout } = useAuth();
  const { features } = useFeatures();
  const pathname = usePathname();

  if (!apiKey) return null;

  const catalogEnabled = features?.catalog_enabled ?? false;
  const links = [
    ...baseLinks,
    ...(catalogEnabled ? catalogLinks : []),
    ...trailingLinks,
  ];

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <span className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <img src="/logo.svg" alt="" width={28} height={28} />
            ABMCY <span className="text-indigo-600">Dashboard</span>
          </span>
          <nav className="flex flex-wrap gap-1">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            {!catalogEnabled && (
              <span
                title="Catalogue non activé pour votre compte. Contactez ABMCY pour l'activer."
                className="flex cursor-help items-center rounded-md px-3 py-1.5 text-sm font-medium text-slate-300"
              >
                Catalogue non activé
              </span>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            Documentation
          </a>
          <button
            onClick={logout}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </header>
  );
}
