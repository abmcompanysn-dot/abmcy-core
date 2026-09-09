// Le dashboard admin (ad.abmcy.com) n'est volontairement pas mis en avant
// sur le site public — usage interne ABMCY uniquement.
const TENANT_DASHBOARD_URL = "https://dash.abmcy.com";

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-gradient-to-b from-indigo-50 via-white to-white"
    >
      {/* Décor discret en fond, purement visuel */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]"
      >
        <div className="absolute left-1/2 top-[-10%] h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-indigo-200/40 blur-3xl" />
      </div>

      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 py-24 text-center sm:py-32">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-1.5 text-xs font-medium text-indigo-700">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-indigo-600" />
          Plateforme multi-tenant pour commerces et artisans
        </div>

        <h1 className="text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          Digitalisez votre commerce avec{" "}
          <span className="text-indigo-600">ABMCY Core</span>
        </h1>

        <p className="mt-6 max-w-2xl text-balance text-lg text-slate-600 sm:text-xl">
          Une seule plateforme pour gérer vos commandes sur-mesure, encaisser
          en Wave, Orange Money ou MTN MoMo, stocker vos photos produits et
          prévenir vos clients par email — sans rien construire vous-même.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <a
            href={TENANT_DASHBOARD_URL}
            className="w-full rounded-full bg-indigo-600 px-7 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 hover:shadow-indigo-600/30 sm:w-auto"
          >
            Accéder à mon espace commerçant
          </a>
          <a
            href="#fonctionnalites"
            className="w-full rounded-full border border-slate-200 bg-white px-7 py-3.5 text-center text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
          >
            En savoir plus
          </a>
        </div>
      </div>
    </section>
  );
}
