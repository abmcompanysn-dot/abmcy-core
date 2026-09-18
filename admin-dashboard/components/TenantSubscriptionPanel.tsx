"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import {
  ApiError,
  getTenantSubscription,
  listTenantSubscriptionPayments,
  setTenantSubscriptionPrice,
  type Subscription,
  type SubscriptionPayment,
} from "@/lib/api";

const STATUS_STYLES: Record<Subscription["status"], string> = {
  inactive: "bg-slate-100 text-slate-600",
  active: "bg-emerald-50 text-emerald-700",
  past_due: "bg-amber-50 text-amber-700",
  cancelled: "bg-red-50 text-red-700",
};

const STATUS_LABELS: Record<Subscription["status"], string> = {
  inactive: "Pas encore d'abonnement",
  active: "Actif",
  past_due: "Paiement en retard",
  cancelled: "Résilié",
};

function formatFCFA(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(amount))} FCFA`;
}

/** Prix + statut d'abonnement d'un tenant, avec historique de
 * facturation — panneau dédié dans la page profil tenant admin. */
export function TenantSubscriptionPanel({ tenantId }: { tenantId: string }) {
  const { adminKey } = useAuth();
  const { showToast } = useToast();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [priceInput, setPriceInput] = useState("");
  const [saving, setSaving] = useState(false);
  // "loading" dérive de la comparaison entre la dernière requête déclenchée
  // et la dernière traitée, plutôt que d'un setState synchrone en tête
  // d'effet (voir tenant-dashboard/app/page.tsx pour le même principe).
  const [reloadToken] = useState(0);
  const [settledToken, setSettledToken] = useState(-1);
  const loading = settledToken !== reloadToken;

  useEffect(() => {
    if (!adminKey || !tenantId) return;
    let cancelled = false;
    Promise.all([
      getTenantSubscription(adminKey, tenantId),
      listTenantSubscriptionPayments(adminKey, tenantId),
    ])
      .then(([sub, pays]) => {
        if (cancelled) return;
        setSubscription(sub);
        setPayments(pays ?? []);
        setPriceInput(sub.price_fcfa != null ? String(sub.price_fcfa) : "");
      })
      .catch(() => {
        // Silencieux : un tenant peut légitimement ne pas encore avoir
        // de ligne d'abonnement exploitable.
      })
      .finally(() => {
        if (!cancelled) setSettledToken(reloadToken);
      });
    return () => {
      cancelled = true;
    };
  }, [adminKey, tenantId, reloadToken]);

  async function handleSavePrice() {
    if (!adminKey) return;
    const price = Number(priceInput);
    if (!Number.isFinite(price) || price < 0) {
      showToast("Montant invalide.", "error");
      return;
    }
    setSaving(true);
    try {
      await setTenantSubscriptionPrice(adminKey, tenantId, Math.round(price));
      const sub = await getTenantSubscription(adminKey, tenantId);
      setSubscription(sub);
      showToast("Prix d'abonnement enregistré.", "success");
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Impossible d'enregistrer le prix.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">Abonnement</h2>
        {subscription && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[subscription.status]}`}
          >
            {STATUS_LABELS[subscription.status]}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">
            Prix mensuel (FCFA)
          </span>
          <input
            type="number"
            min={0}
            step={500}
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            placeholder="ex : 15000"
            className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </label>
        <button
          onClick={handleSavePrice}
          disabled={saving}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer le prix"}
        </button>
      </div>

      {subscription?.next_billing_at && (
        <p className="text-xs text-slate-500">
          Prochaine échéance :{" "}
          {new Date(subscription.next_billing_at).toLocaleDateString("fr-FR")}
        </p>
      )}
      {subscription?.cgu_accepted_at ? (
        <p className="text-xs text-slate-500">
          CGU acceptées le{" "}
          {new Date(subscription.cgu_accepted_at).toLocaleDateString("fr-FR")}
        </p>
      ) : (
        <p className="text-xs text-amber-600">CGU pas encore acceptées.</p>
      )}

      {payments.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Historique
          </h3>
          <div className="space-y-1.5">
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-slate-600">
                  {new Date(p.created_at).toLocaleDateString("fr-FR")}
                </span>
                <span className="text-slate-900">{formatFCFA(p.amount_fcfa)}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.status === "paid"
                      ? "bg-emerald-50 text-emerald-700"
                      : p.status === "failed"
                        ? "bg-red-50 text-red-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {p.status === "paid" ? "Payé" : p.status === "failed" ? "Échoué" : "En attente"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
