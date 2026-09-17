"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, getProfile, sendInvoiceEmail, type Order, type TenantProfile } from "@/lib/api";
import { buildInvoicePdf, invoiceBase64, invoiceFilename } from "@/lib/invoice";

/** Génération et envoi de la facture d'une commande — tout se passe côté
 * navigateur (le PDF n'est jamais généré ni stocké par le backend), sauf
 * l'envoi par email qui relaie le PDF déjà produit à Resend via une
 * route dédiée. */
export function InvoiceActions({ order }: { order: Order }) {
  const { apiKey } = useAuth();
  const { showToast } = useToast();
  const [tenant, setTenant] = useState<TenantProfile | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    getProfile(apiKey)
      .then((profile) => {
        if (!cancelled) setTenant(profile);
      })
      .catch(() => {
        // Le profil n'est utile que pour l'en-tête du PDF — son absence
        // ne doit pas empêcher de générer/télécharger la facture.
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  function handleDownload() {
    const doc = buildInvoicePdf(order, tenant);
    doc.save(invoiceFilename(order));
  }

  async function handleSendEmail() {
    if (!apiKey) return;
    if (!order.customer_email) {
      showToast("Cette commande n'a pas d'adresse email renseignée.", "error");
      return;
    }
    setSending(true);
    try {
      const doc = buildInvoicePdf(order, tenant);
      await sendInvoiceEmail(
        apiKey,
        order.id,
        invoiceBase64(doc),
        invoiceFilename(order)
      );
      showToast(`Facture envoyée à ${order.customer_email}.`, "success");
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Impossible d'envoyer la facture.",
        "error"
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={handleDownload}
        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
      >
        Télécharger la facture
      </button>
      <button
        onClick={handleSendEmail}
        disabled={sending || !order.customer_email}
        title={
          order.customer_email
            ? undefined
            : "Cette commande n'a pas d'adresse email renseignée."
        }
        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
      >
        {sending ? "Envoi..." : "Envoyer par email"}
      </button>
    </div>
  );
}
