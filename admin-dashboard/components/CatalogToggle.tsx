"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import {
  ApiError,
  FEATURE_LABELS,
  getTenantFeatures,
  updateTenantFeatures,
  type FeatureFlags,
} from "@/lib/api";

const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as (keyof FeatureFlags)[];

/**
 * Cinq interrupteurs indépendants pour un tenant : produits, tissus,
 * panier, galerie, avis — charge l'état actuel via GET
 * /admin/tenants/{id}/features puis bascule un service à la fois via PUT
 * sur la même route (en renvoyant l'ensemble des flags, PUT remplace tout).
 * Un tenant de couture sur-mesure comme HANI'S peut par exemple activer
 * produits/tissus/galerie/avis sans panier classique — les commandes
 * passent par le flux sur-mesure dédié.
 */
export function CatalogToggle({ tenantId }: { tenantId: string }) {
  const { adminKey } = useAuth();
  const { showToast } = useToast();
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<keyof FeatureFlags | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminKey) return;
    let ignore = false;

    (async () => {
      try {
        const data = await getTenantFeatures(adminKey, tenantId);
        if (ignore) return;
        setFlags(data);
        setError(null);
      } catch (err) {
        if (ignore) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger les services activés."
        );
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [adminKey, tenantId]);

  async function handleToggle(key: keyof FeatureFlags) {
    if (!adminKey || !flags || savingKey) return;
    const next: FeatureFlags = { ...flags, [key]: !flags[key] };
    setSavingKey(key);
    setError(null);
    try {
      await updateTenantFeatures(adminKey, tenantId, next);
      setFlags(next);
      showToast(
        `${FEATURE_LABELS[key]} ${next[key] ? "activé" : "désactivé"}.`,
        "success"
      );
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Impossible de mettre à jour ce service.";
      setError(message);
      showToast(message, "error");
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return <span className="text-xs text-slate-400">Chargement...</span>;
  }

  if (!flags) {
    return (
      <span className="text-xs text-red-600">
        {error ?? "Indisponible"}
      </span>
    );
  }

  return (
    <div className="space-y-1.5">
      {FEATURE_KEYS.map((key) => {
        const enabled = flags[key];
        const saving = savingKey === key;
        return (
          <div key={key} className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => handleToggle(key)}
              disabled={saving}
              title={
                enabled
                  ? `Désactiver ${FEATURE_LABELS[key]} pour ce tenant`
                  : `Activer ${FEATURE_LABELS[key]} pour ce tenant`
              }
              className={`relative inline-flex h-4.5 w-8 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                enabled ? "bg-emerald-500" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-4" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-xs font-medium text-slate-600">
              {FEATURE_LABELS[key]}
            </span>
          </div>
        );
      })}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
