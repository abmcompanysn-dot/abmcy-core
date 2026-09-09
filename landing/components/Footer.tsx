const NAV_LINKS = [
  { href: "#architecture", label: "Architecture" },
  { href: "#fonctionnalites", label: "Fonctionnalités" },
];

// Le dashboard admin (ad.abmcy.com) n'est volontairement pas mis en avant
// sur le site public — usage interne ABMCY uniquement.
const TENANT_DASHBOARD_URL = "https://dash.abmcy.com";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <a href="#top" className="flex items-center gap-2 font-semibold text-slate-900">
            <img src="/logo.svg" alt="" width={32} height={32} />
            <span>
              ABMCY <span className="text-indigo-600">Core</span>
            </span>
          </a>
          <p className="mt-3 max-w-xs text-sm text-slate-500">
            La plateforme multi-tenant qui digitalise les commerces et
            artisans ouest-africains, un tenant à la fois.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-12 gap-y-6 text-sm">
          <div className="flex flex-col gap-2">
            <span className="font-medium text-slate-900">Navigation</span>
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-slate-500 transition-colors hover:text-slate-900"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-medium text-slate-900">Espaces</span>
            <a
              href={TENANT_DASHBOARD_URL}
              className="text-slate-500 transition-colors hover:text-slate-900"
            >
              Espace commerçant
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 px-6 py-6 text-center text-xs text-slate-400">
        © {year} ABMCY. Tous droits réservés.
      </div>
    </footer>
  );
}
