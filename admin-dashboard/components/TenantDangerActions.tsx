"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, deleteTenant, regenerateTenantApiKeys } from "@/lib/api";
import { NewSecretModal } from "./NewSecretModal";

/**
 * Actions destructives par tenant dans le tableau admin : régénérer la
 * paire de clés API (l'ancienne cesse aussitôt de fonctionner) et
 * supprimer définitivement le tenant avec toutes ses données.
 */
export function TenantDangerActions({
  tenantId,
  tenantName,
  onDeleted,
}: {
  tenantId: string;
  tenantName: string;
  onDeleted: (tenantId: string) => void;
}) {
  const { adminKey } = useAuth();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  async function handleRegenerate() {
    if (!adminKey || busy) return;
    if (
      !window.confirm(
        `Régénérer les clés API de « ${tenantName} » ? L'ancienne clé cessera immédiatement de fonctionner pour toutes ses intégrations.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const result = await regenerateTenantApiKeys(adminKey, tenantId);
      setNewSecret(result.api_key_secret);
      showToast("Clés API régénérées.", "success");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Impossible de régénérer les clés.";
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!adminKey || busy) return;
    if (
      !window.confirm(
        `Supprimer définitivement « ${tenantName} » ? Toutes ses données (commandes, produits, clients, comptes, logs) seront perdues. Cette action est irréversible.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await deleteTenant(adminKey, tenantId);
      showToast(`Tenant « ${tenantName} » supprimé.`, "success");
      onDeleted(tenantId);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Impossible de supprimer le tenant.";
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleRegenerate}
        disabled={busy}
        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
      >
        Régénérer les clés
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        Supprimer
      </button>

      {newSecret && (
        <NewSecretModal
          tenantName={tenantName}
          secret={newSecret}
          title={`Nouvelles clés API — « ${tenantName} »`}
          onClose={() => setNewSecret(null)}
        />
      )}
    </div>
  );
}
