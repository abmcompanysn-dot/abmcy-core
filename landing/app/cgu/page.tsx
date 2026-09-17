import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Conditions d'utilisation & mentions légales — ABMCY Core",
  description:
    "Conditions générales d'utilisation, confidentialité et mentions légales d'ABMCY Core, édité par Mahu Digital System.",
};

export default function CGUPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
          <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Conditions d&apos;utilisation & mentions légales
          </h1>
          <p className="mt-4 text-sm text-slate-500">
            Dernière mise à jour : 17 septembre 2026
          </p>

          <div className="mt-10 space-y-8 text-sm leading-relaxed text-slate-700">
            <section>
              <h2 className="text-lg font-semibold text-slate-900">
                1. Éditeur de la plateforme
              </h2>
              <p className="mt-2">
                ABMCY Core est édité par <strong>Mahu Digital System</strong>{" "}
                — Médina Rue 13 Angle 12, Dakar, Sénégal — NINEA 012834182 —
                RCCM SN.DKR.2026.A.6465.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">
                2. Objet
              </h2>
              <p className="mt-2">
                ABMCY Core est une plateforme SaaS/BaaS multi-tenant qui
                permet à un commerce, un artisan ou un créateur (le
                « tenant ») de digitaliser son activité : gestion des
                commandes, catalogue, paiements mobile money, notifications
                et, le cas échéant, un site vitrine (storefront) destiné à
                ses propres clients.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">
                3. Abonnement et facturation
              </h2>
              <p className="mt-2">
                L&apos;accès à la plateforme est soumis à un abonnement
                mensuel dont le montant est convenu individuellement entre
                Mahu Digital System et chaque tenant. Le tenant s&apos;engage
                à régler son abonnement à chaque échéance. En cas d&apos;impayé
                prolongé au-delà du délai de grâce indiqué dans son espace
                d&apos;administration, l&apos;accès à la plateforme (dashboard
                et site public) peut être suspendu jusqu&apos;à
                régularisation.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">
                4. Confidentialité et propriété des données
              </h2>
              <p className="mt-2">
                Chaque tenant reste seul propriétaire des données qu&apos;il
                saisit sur la plateforme (produits, commandes, clients,
                contenus). Ces données sont isolées techniquement entre
                tenants et ne sont accessibles à Mahu Digital System que
                dans le cadre de l&apos;exploitation, de la maintenance ou
                du support de la plateforme, ou à la demande du tenant
                lui-même. Elles ne sont ni vendues ni communiquées à des
                tiers en dehors des prestataires techniques strictement
                nécessaires au fonctionnement du service (hébergement,
                paiement, envoi d&apos;emails).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">
                5. Résiliation
              </h2>
              <p className="mt-2">
                Le tenant peut demander la résiliation de son compte à tout
                moment auprès de Mahu Digital System. Mahu Digital System
                peut suspendre ou résilier un compte en cas de non-paiement
                prolongé, de violation des présentes conditions, ou
                d&apos;usage frauduleux de la plateforme.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900">
                6. Contact
              </h2>
              <p className="mt-2">
                Pour toute question relative aux présentes conditions,
                contactez Mahu Digital System — Médina Rue 13 Angle 12,
                Dakar, Sénégal.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
