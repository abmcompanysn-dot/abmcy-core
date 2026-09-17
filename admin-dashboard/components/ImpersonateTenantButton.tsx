"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, TENANT_DASHBOARD_URL, impersonateTenant } from "@/lib/api";

/**
 * "Se connecter en tant que" — ouvre le dashboard du tenant, déjà
 * connecté sur son compte owner, dans un nouvel onglet. Sert au support
 * technique ABMCY : pas besoin de connaître ni de réinitialiser le mot
 * de passe du tenant pour l'assister. Le token émis expire après 1h.
 */
export function ImpersonateTenantButton({
  tenantId,
  tenantName,
}: {
  tenantId: string;
  tenantName: string;
}) {
  const { adminKey } = useAuth();
  const { showToast } = useToast();
  const [opening, setOpening] = useState(false);

  async function handleClick() {
    if (!adminKey || opening) return;
    setOpening(true);
    try {
      const { token } = await impersonateTenant(adminKey, tenantId);
      const url = `${TENANT_DASHBOARD_URL}/?impersonate_token=${encodeURIComponent(token)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Impossible d'ouvrir ce dashboard.",
        "error"
      );
    } finally {
      setOpening(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={opening}
      title={`Ouvrir le dashboard de ${tenantName} connecté en tant que owner`}
      className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
    >
      {opening ? "Ouverture..." : "Se connecter en tant que"}
    </button>
  );
}
