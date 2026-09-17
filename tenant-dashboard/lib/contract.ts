import { jsPDF } from "jspdf";
import type { Subscription, TenantProfile } from "./api";
import { formatFCFA } from "./format";

const EDITOR_LINES = [
  "Éditeur : Mahu Digital System",
  "Médina Rue 13 Angle 12, Dakar, Sénégal",
  "NINEA 012834182 — RCCM SN.DKR.2026.A.6465",
];

/** Construit le contrat d'abonnement ABMCY Core d'un tenant, entièrement
 * côté navigateur — même principe que lib/invoice.ts : le PDF n'est
 * généré ni stocké côté serveur tant que le tenant ne demande pas
 * explicitement l'envoi par email. */
export function buildContractPdf(
  tenant: TenantProfile | null,
  subscription: Subscription | null
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginX = 20;
  let y = 20;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Contrat d'abonnement ABMCY Core", marginX, y);

  y += 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  for (const line of EDITOR_LINES) {
    doc.text(line, marginX, y);
    y += 5;
  }

  y += 6;
  doc.setDrawColor(220);
  doc.line(marginX, y, 190, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.text("Client", marginX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(tenant?.name ?? "—", marginX, y);
  y += 5;
  doc.text(`Identifiant boutique : ${tenant?.slug ?? "—"}`, marginX, y);

  y += 12;
  doc.setFont("helvetica", "bold");
  doc.text("Abonnement", marginX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(
    subscription?.price_fcfa != null
      ? `Montant mensuel : ${formatFCFA(subscription.price_fcfa)}`
      : "Montant mensuel : non défini",
    marginX,
    y
  );
  y += 5;
  doc.text(`Statut : ${STATUS_LABELS[subscription?.status ?? "inactive"]}`, marginX, y);
  if (subscription?.next_billing_at) {
    y += 5;
    doc.text(
      `Prochaine échéance : ${new Date(subscription.next_billing_at).toLocaleDateString("fr-FR")}`,
      marginX,
      y
    );
  }

  y += 14;
  doc.setFont("helvetica", "bold");
  doc.text("Conditions", marginX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const terms = [
    "L'accès à la plateforme ABMCY Core est soumis au paiement de l'abonnement",
    "mensuel ci-dessus. En cas d'impayé prolongé au-delà du délai de grâce indiqué",
    "dans le dashboard, l'accès au dashboard et au site public du tenant peut être",
    "suspendu jusqu'à régularisation. Les données du tenant restent sa propriété",
    "et sont isolées techniquement des autres tenants de la plateforme.",
  ];
  for (const line of terms) {
    doc.text(line, marginX, y, { maxWidth: 170 });
    y += 5;
  }

  y += 10;
  doc.setFontSize(9);
  doc.text(
    `Document généré le ${new Date().toLocaleDateString("fr-FR")}.`,
    marginX,
    y
  );

  return doc;
}

const STATUS_LABELS: Record<string, string> = {
  inactive: "Pas encore d'abonnement actif",
  active: "Actif",
  past_due: "Paiement en retard",
  cancelled: "Résilié",
};

export function contractFilename(tenant: TenantProfile | null): string {
  return `contrat-abmcy-core-${tenant?.slug ?? "tenant"}.pdf`;
}

/** Extrait le contenu base64 (sans le préfixe data URI) d'un jsPDF, prêt
 * à être envoyé au backend en pièce jointe — même utilitaire que
 * lib/invoice.ts, dupliqué ici pour ne pas coupler les deux domaines. */
export function contractBase64(doc: jsPDF): string {
  return doc.output("datauristring").split(",")[1] ?? "";
}
