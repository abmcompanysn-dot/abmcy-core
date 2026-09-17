import { jsPDF } from "jspdf";
import type { Order, TenantProfile } from "./api";
import { formatDate, formatFCFA } from "./format";

/** Construit le PDF de facture d'une commande, entièrement côté
 * navigateur (aucune donnée de facturation ne transite par le backend
 * tant que l'utilisateur ne demande pas explicitement l'envoi par
 * email — voir sendInvoiceEmail dans lib/api.ts). */
export function buildInvoicePdf(order: Order, tenant: TenantProfile | null): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginX = 20;
  let y = 20;

  // En-tête : identité du tenant
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(tenant?.name ?? "Facture", marginX, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  y += 8;
  doc.text("Facture", marginX, y);

  // N° commande + date, alignés à droite
  doc.setFontSize(10);
  doc.text(`N° ${order.order_number}`, 190, 20, { align: "right" });
  doc.text(formatDate(order.created_at), 190, 26, { align: "right" });

  y += 12;
  doc.setDrawColor(220);
  doc.line(marginX, y, 190, y);
  y += 10;

  // Client
  doc.setFont("helvetica", "bold");
  doc.text("Facturé à", marginX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(order.customer_name, marginX, y);
  y += 5;
  doc.text(order.customer_phone, marginX, y);
  if (order.customer_email) {
    y += 5;
    doc.text(order.customer_email, marginX, y);
  }
  if (order.shipping_address) {
    y += 5;
    doc.text(order.shipping_address, marginX, y, { maxWidth: 150 });
  }

  y += 14;

  // Tableau des articles (si la commande en a — sinon un total simple)
  const items = order.items ?? [];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Description", marginX, y);
  doc.text("Qté", 130, y, { align: "right" });
  doc.text("P.U.", 155, y, { align: "right" });
  doc.text("Total", 190, y, { align: "right" });
  y += 3;
  doc.setDrawColor(220);
  doc.line(marginX, y, 190, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  if (items.length > 0) {
    for (const item of items) {
      doc.text(item.product_name, marginX, y, { maxWidth: 95 });
      doc.text(String(item.quantity), 130, y, { align: "right" });
      doc.text(formatFCFA(item.unit_price), 155, y, { align: "right" });
      doc.text(formatFCFA(item.unit_price * item.quantity), 190, y, {
        align: "right",
      });
      y += 7;
    }
  } else {
    doc.text("Commande sur mesure", marginX, y, { maxWidth: 95 });
    doc.text("1", 130, y, { align: "right" });
    doc.text(formatFCFA(order.total_amount), 155, y, { align: "right" });
    doc.text(formatFCFA(order.total_amount), 190, y, { align: "right" });
    y += 7;
  }

  y += 6;
  doc.setDrawColor(220);
  doc.line(marginX, y, 190, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total", 155, y, { align: "right" });
  doc.text(formatFCFA(order.total_amount), 190, y, { align: "right" });

  if (order.notes) {
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Notes", marginX, y);
    y += 5;
    doc.text(order.notes, marginX, y, { maxWidth: 170 });
  }

  return doc;
}

/** Nom de fichier standard pour une facture, réutilisé pour le
 * téléchargement et la pièce jointe email. */
export function invoiceFilename(order: Order): string {
  return `facture-${order.order_number}.pdf`;
}

/** Extrait le contenu base64 (sans le préfixe data URI) d'un jsPDF, prêt
 * à être envoyé au backend en pièce jointe. */
export function invoiceBase64(doc: jsPDF): string {
  return doc.output("datauristring").split(",")[1] ?? "";
}
