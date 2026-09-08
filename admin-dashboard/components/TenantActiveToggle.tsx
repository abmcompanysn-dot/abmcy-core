"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, updateTenantActive } from "@/lib/api";
import { StatusBadge } from "./StatusBadge";

/**
 * Interrupteur "Tenant actif" utilisé dans le tableau des tenants. Un
 * tenant suspendu voit ses requêtes X-API-Key / JWT staff rejetées côté
 * backend (middleware.TenantAuth vérifie is_active) — ce bouton bascule
 * directement cette protection déjà en place, sans rien d'autre à faire.
 */
export function TenantActiveToggle({
  tenantId,
  isActive,
  onSaved,
}: {
  tenantId: string;
  isActive: boolean;
  onSaved: (isActive: boolean) => void;
}) {
  const { adminKey } = useAuth();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (!adminKey || saving) return;
    const next = !isActive;
    if (
      !next &&
      !window.confirm(
        "Suspendre ce tenant ? Son personnel et ses intégrations perdront immédiatement l'accès à l'API."
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateTenantActive(adminKey, tenantId, next);
      onSaved(next);
      showToast(next ? "Tenant réactivé." : "Tenant suspendu.", "success");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Impossible de mettre à jour le statut.";
      setError(message);
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={saving}
        title={isActive ? "Suspendre ce tenant" : "Réactiver ce tenant"}
        className="transition-opacity disabled:opacity-50"
      >
        <StatusBadge active={isActive} />
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
