"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import {
  ApiError,
  getTenantFeatures,
  updateTenantFeatures,
} from "@/lib/api";

/**
 * Interrupteur "Catalogue activé" pour un tenant : charge l'état actuel via
 * GET /admin/tenants/{id}/features puis bascule via PUT sur la même route.
 * C'est ce qui permet à ABMCY d'activer le service catalogue (produits,
 * tissus, panier, galerie, avis) pour un client comme HANI'S depuis ce
 * tableau de bord, sans intervention manuelle en base.
 */
export function CatalogToggle({ tenantId }: { tenantId: string }) {
  const { adminKey } = useAuth();
  const { showToast } = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminKey) return;
    let ignore = false;

    (async () => {
      try {
        const flags = await getTenantFeatures(adminKey, tenantId);
        if (ignore) return;
        setEnabled(flags.catalog_enabled);
        setError(null);
      } catch (err) {
        if (ignore) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger l'état du catalogue."
        );
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [adminKey, tenantId]);

  async function handleToggle() {
    if (!adminKey || enabled === null || saving) return;
    const next = !enabled;
    setSaving(true);
    setError(null);
    try {
      await updateTenantFeatures(adminKey, tenantId, { catalog_enabled: next });
      setEnabled(next);
      showToast(next ? "Catalogue activé." : "Catalogue désactivé.", "success");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Impossible de mettre à jour le catalogue.";
      setError(message);
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <span className="text-xs text-slate-400">Chargement...</span>;
  }

  if (enabled === null) {
    return (
      <span className="text-xs text-red-600">
        {error ?? "Indisponible"}
      </span>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={handleToggle}
        disabled={saving}
        title={
          enabled
            ? "Désactiver le catalogue pour ce tenant"
            : "Activer le catalogue pour ce tenant"
        }
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          enabled ? "bg-emerald-500" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-4.5" : "translate-x-1"
          }`}
        />
      </button>
      <p className="text-xs font-medium text-slate-600">
        {enabled ? "Activé" : "Désactivé"}
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
