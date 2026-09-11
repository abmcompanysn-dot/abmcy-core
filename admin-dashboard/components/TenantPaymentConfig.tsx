"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import {
  ApiError,
  deleteTenantPaymentConfig,
  getTenantPaymentConfig,
  setTenantPaymentConfig,
} from "@/lib/api";

/**
 * Édition des clés ABMCY Core Payment d'un tenant (app_key + hmac_secret,
 * créées dans la console ABMCY Core Payment). Les valeurs ne sont jamais
 * relues — on affiche seulement si elles sont renseignées. Chaque tenant
 * encaisse ainsi sur son propre compte.
 */
export function TenantPaymentConfig({ tenantId }: { tenantId: string }) {
  const { adminKey } = useAuth();
  const { showToast } = useToast();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [appKey, setAppKey] = useState("");
  const [hmacSecret, setHmacSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!adminKey) return;
    let cancelled = false;
    getTenantPaymentConfig(adminKey, tenantId)
      .then((res) => {
        if (!cancelled) setConfigured(res.configured);
      })
      .catch(() => {
        if (!cancelled) setConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, [adminKey, tenantId, reloadToken]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!adminKey || saving) return;
    if (!appKey.trim() || !hmacSecret.trim()) {
      showToast("app_key et hmac_secret sont obligatoires.", "error");
      return;
    }
    setSaving(true);
    try {
      await setTenantPaymentConfig(adminKey, tenantId, {
        app_key: appKey.trim(),
        hmac_secret: hmacSecret.trim(),
      });
      setAppKey("");
      setHmacSecret("");
      setReloadToken((t) => t + 1);
      showToast("Clés de paiement enregistrées.", "success");
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Impossible d'enregistrer les clés.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!adminKey || saving) return;
    if (
      !window.confirm(
        "Retirer les clés de paiement de ce tenant ? Ses paiements répondront 503 jusqu'à ce que de nouvelles clés soient renseignées."
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await deleteTenantPaymentConfig(adminKey, tenantId);
      setReloadToken((t) => t + 1);
      showToast("Clés de paiement retirées.", "success");
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Impossible de retirer les clés.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">
          Paiement — ABMCY Core Payment
        </h2>
        {configured !== null && (
          <span
            className={
              configured
                ? "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                : "inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
            }
          >
            {configured ? "Configuré" : "Non configuré"}
          </span>
        )}
      </div>

      <p className="text-sm text-slate-500">
        Clés de l&apos;application créée par ce tenant dans la console ABMCY
        Core Payment. Renseigner ici les remplace ; elles ne sont jamais
        réaffichées.
      </p>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            app_key
          </span>
          <input
            type="text"
            value={appKey}
            onChange={(e) => setAppKey(e.target.value)}
            placeholder={configured ? "••• (déjà renseigné)" : "app_..."}
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            hmac_secret
          </span>
          <input
            type="password"
            value={hmacSecret}
            onChange={(e) => setHmacSecret(e.target.value)}
            placeholder={configured ? "••• (déjà renseigné)" : "secret..."}
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none"
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer les clés"}
        </button>
        {configured && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            Retirer les clés
          </button>
        )}
      </div>
    </form>
  );
}
