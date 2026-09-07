const NAV_LINKS = [
  { href: "#architecture", label: "Architecture" },
  { href: "#fonctionnalites", label: "Fonctionnalités" },
];

// Placeholders explicites : à remplacer par les vraies URLs une fois les
// dashboards déployés (ad.abmcy.com / dash.abmcy.com).
const ADMIN_DASHBOARD_URL = "https://ad.abmcy.com";
const TENANT_DASHBOARD_URL = "https://dash.abmcy.com";
// Documentation d'intégration API (docs/API.md dans le repo, publiée en
// page web) — voir DOCS_URL dans chaque app pour garder ce lien unique.
export const DOCS_URL =
  "https://claude.ai/code/artifact/377e23f8-72f3-4c5e-b1a9-bb636dfba484";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#top" className="flex items-center gap-2 font-semibold text-slate-900">
          <img src="/logo.svg" alt="" width={32} height={32} />
          <span>
            ABMCY <span className="text-indigo-600">Core</span>
          </span>
        </a>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-slate-900"
            >
              {link.label}
            </a>
          ))}
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-slate-900"
          >
            Documentation
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={TENANT_DASHBOARD_URL}
            className="hidden rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 sm:inline-flex"
          >
            Espace client
          </a>
          <a
            href={ADMIN_DASHBOARD_URL}
            className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            Espace ABMCY
          </a>
        </div>
      </div>
    </header>
  );
}
