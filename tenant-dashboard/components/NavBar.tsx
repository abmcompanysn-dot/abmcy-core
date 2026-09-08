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
    <>
      {/* Desktop : sidebar fixe à gauche, pleine hauteur */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 px-6 py-5 text-lg font-semibold text-slate-900">
          <img src="/logo.svg" alt="" width={28} height={28} />
          ABMCY <span className="text-indigo-600">Dashboard</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
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
              className="cursor-help rounded-md px-3 py-2 text-sm font-medium text-slate-300"
            >
              Catalogue non activé
            </span>
          )}
        </nav>
        <div className="flex flex-col gap-1 border-t border-slate-200 px-3 py-4">
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            Documentation
          </a>
          <button
            onClick={logout}
            className="rounded-md border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Mobile / tablette : header horizontal, nav défilable */}
      <header className="border-b border-slate-200 bg-white md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <img src="/logo.svg" alt="" width={24} height={24} />
            ABMCY <span className="text-indigo-600">Dashboard</span>
          </span>
          <button
            onClick={logout}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            Se déconnecter
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-3">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
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
              className="flex shrink-0 cursor-help items-center rounded-md px-3 py-1.5 text-sm font-medium text-slate-300"
            >
              Catalogue non activé
            </span>
          )}
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            Documentation
          </a>
        </nav>
      </header>
    </>
  );
}
