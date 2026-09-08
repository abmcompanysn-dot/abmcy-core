"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DOCS_URL } from "@/lib/api";

const links = [
  { href: "/", label: "Tenants" },
  { href: "/comptes", label: "Comptes admin" },
  { href: "/trafic", label: "Trafic" },
  { href: "/services", label: "Services" },
  { href: "/config", label: "Configuration" },
];

export function NavBar() {
  const { adminKey, logout } = useAuth();
  const pathname = usePathname();

  if (!adminKey) return null;

  return (
    <>
      {/* Desktop : sidebar fixe à gauche, pleine hauteur — même
          traitement que tenant-dashboard/components/NavBar.tsx pour
          garder les deux dashboards ABMCY visuellement cohérents. */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 px-6 py-5 text-lg font-semibold text-slate-900">
          <img src="/logo.svg" alt="" width={28} height={28} />
          ABMCY <span className="text-indigo-600">Admin</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);
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
            ABMCY <span className="text-indigo-600">Admin</span>
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
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);
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
