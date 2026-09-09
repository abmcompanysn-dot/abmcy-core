import { Building2, Server, CreditCard, type LucideIcon } from "lucide-react";

type PartnerDef = {
  icon: LucideIcon;
  name: string;
  role: string;
};

const PARTNERS: PartnerDef[] = [
  {
    icon: Building2,
    name: "MAHU",
    role: "Société mère du groupe ABMCY",
  },
  {
    icon: Server,
    name: "Diarra",
    role: "Partenaire infrastructure & hébergement",
  },
  {
    icon: CreditCard,
    name: "ABMCY Core Payment",
    role: "Notre passerelle de paiement mobile money & carte",
  },
];

export function Partners() {
  return (
    <section className="border-t border-slate-100 bg-slate-50/60 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Un groupe qui vous accompagne
          </h2>
          <p className="mt-4 text-balance text-base text-slate-600">
            ABMCY Core s&apos;appuie sur un réseau d&apos;entreprises de
            confiance pour vous offrir une plateforme fiable, de bout en bout.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {PARTNERS.map((partner) => {
            const Icon = partner.icon;
            return (
              <div
                key={partner.name}
                className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm"
              >
                <Icon className="h-7 w-7 text-indigo-600" strokeWidth={1.75} aria-hidden />
                <span className="text-base font-semibold text-slate-900">
                  {partner.name}
                </span>
                <span className="text-sm text-slate-500">{partner.role}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
