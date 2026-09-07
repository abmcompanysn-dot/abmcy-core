type FeatureDef = {
  icon: string;
  title: string;
  description: string;
};

// Une carte par capacité clé de la plateforme, décrite en langage commerçant
// plutôt qu'en jargon technique — public visé : commerçants/artisans.
const FEATURES: FeatureDef[] = [
  {
    icon: "🔒",
    title: "Vos données, isolées et sécurisées",
    description:
      "Chaque commerce dispose de son propre espace, totalement séparé des autres, grâce à une isolation stricte au niveau de la base de données (Row Level Security).",
  },
  {
    icon: "🧵",
    title: "Commandes sur-mesure",
    description:
      "Suivez chaque commande avec ses mesures, ses options et son statut, du premier contact client jusqu'à la livraison.",
  },
  {
    icon: "📱",
    title: "Paiements mobile money",
    description:
      "Encaissez directement en Wave, Orange Money, MTN MoMo ou par carte bancaire, sans jongler entre plusieurs outils.",
  },
  {
    icon: "📸",
    title: "Photos produits avec suivi de quota",
    description:
      "Ajoutez les photos de vos réalisations en quelques clics, avec un espace de stockage dédié et un suivi clair de votre consommation.",
  },
  {
    icon: "📧",
    title: "Notifications par email",
    description:
      "Tenez vos clients informés automatiquement à chaque étape importante de leur commande, sans y penser.",
  },
];

export function Features() {
  return (
    <section id="fonctionnalites" className="bg-slate-50 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Tout ce qu&apos;il faut pour digitaliser votre commerce
          </h2>
          <p className="mt-4 text-balance text-lg text-slate-600">
            Pensé pour les commerçants et artisans, sans complexité technique
            à gérer de votre côté.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="text-3xl" aria-hidden>
                {feature.icon}
              </span>
              <h3 className="text-base font-semibold text-slate-900">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-slate-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
