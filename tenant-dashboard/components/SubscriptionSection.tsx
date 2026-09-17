"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import {
  ApiError,
  createSubscriptionInvoice,
  getProfile,
  getSubscription,
  sendContractEmail,
  type Subscription,
  type TenantProfile,
} from "@/lib/api";
import { buildContractPdf, contractBase64, contractFilename } from "@/lib/contract";
import { formatFCFA } from "@/lib/format";

const STATUS_STYLES: Record<Subscription["status"], string> = {
  inactive: "bg-slate-100 text-slate-600",
  active: "bg-emerald-50 text-emerald-700",
  past_due: "bg-amber-50 text-amber-700",
  cancelled: "bg-red-50 text-red-700",
};

const STATUS_LABELS: Record<Subscription["status"], string> = {
  inactive: "Pas encore d'abonnement actif",
  active: "Actif",
  past_due: "Paiement en retard",
  cancelled: "Résilié",
};

export function SubscriptionSection() {
  const { apiKey } = useAuth();
  const { showToast } = useToast();
  const [tenant, setTenant] = useState<TenantProfile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payingNow, setPayingNow] = useState(false);
  const [sendingContract, setSendingContract] = useState(false);

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    Promise.all([getProfile(apiKey), getSubscription(apiKey)])
      .then(([profile, sub]) => {
        if (cancelled) return;
        setTenant(profile);
        setSubscription(sub);
      })
      .catch(() => {
        // Best-effort : une facturation pas encore configurée pour ce
        // tenant ne doit pas casser le reste de la page paramètres.
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  async function handlePayNow() {
    if (!apiKey || payingNow) return;
    setPayingNow(true);
    try {
      const payment = await createSubscriptionInvoice(apiKey, window.location.href);
      if (payment.payment_url) {
        window.location.href = payment.payment_url;
      }
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Impossible de générer le lien de paiement.",
        "error"
      );
    } finally {
      setPayingNow(false);
    }
  }

  function handleDownloadContract() {
    const doc = buildContractPdf(tenant, subscription);
    doc.save(contractFilename(tenant));
  }

  async function handleSendContract() {
    if (!apiKey || sendingContract) return;
    setSendingContract(true);
    try {
      const doc = buildContractPdf(tenant, subscription);
      await sendContractEmail(apiKey, contractBase64(doc), contractFilename(tenant));
      showToast("Contrat envoyé par email.", "success");
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Impossible d'envoyer le contrat.",
        "error"
      );
    } finally {
      setSendingContract(false);
    }
  }

  if (!subscription) return null;

  const needsCguAcceptance = !subscription.cgu_accepted_at;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-700">
          Abonnement ABMCY Core
        </h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[subscription.status]}`}
        >
          {STATUS_LABELS[subscription.status]}
        </span>
      </div>

      {subscription.status === "past_due" && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Votre paiement est en retard. Réglez votre abonnement pour éviter
          la suspension de votre compte.
        </p>
      )}

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Montant mensuel</dt>
          <dd className="text-slate-900">
            {subscription.price_fcfa != null
              ? formatFCFA(subscription.price_fcfa)
              : "Non défini"}
          </dd>
        </div>
        {subscription.next_billing_at && (
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Prochaine échéance</dt>
            <dd className="text-slate-900">
              {new Date(subscription.next_billing_at).toLocaleDateString("fr-FR")}
            </dd>
          </div>
        )}
      </dl>

      {subscription.price_fcfa != null &&
        (subscription.status === "past_due" || subscription.status === "active") && (
          <button
            onClick={handlePayNow}
            disabled={payingNow}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {payingNow ? "Redirection..." : "Payer maintenant"}
          </button>
        )}

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <button
          onClick={handleDownloadContract}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
        >
          Télécharger le contrat
        </button>
        <button
          onClick={handleSendContract}
          disabled={sendingContract}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
        >
          {sendingContract ? "Envoi..." : "Envoyer le contrat par email"}
        </button>
      </div>

      <p className="text-xs text-slate-400">
        {needsCguAcceptance ? (
          <>
            Vous n&apos;avez pas encore accepté les{" "}
            <Link
              href="https://cors.abmcy.com/cgu"
              target="_blank"
              className="font-medium text-indigo-600 hover:underline"
            >
              conditions d&apos;utilisation
            </Link>
            .
          </>
        ) : (
          <>
            CGU acceptées le{" "}
            {new Date(subscription.cgu_accepted_at!).toLocaleDateString("fr-FR")}
            {" — "}
            <Link
              href="https://cors.abmcy.com/cgu"
              target="_blank"
              className="font-medium text-indigo-600 hover:underline"
            >
              les consulter
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
