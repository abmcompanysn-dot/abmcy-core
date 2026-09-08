"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  ApiError,
  listTenants,
  type BusinessType,
  type Tenant,
} from "@/lib/api";
import { CreateTenantForm } from "@/components/CreateTenantForm";
import { TenantsTable } from "@/components/TenantsTable";
import { LoadingBlock } from "@/components/Spinner";

export default function TenantsPage() {
  const { adminKey } = useAuth();
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chargement initial au montage (et si la clé admin change) : la
  // récupération est faite directement dans l'effet (IIFE async), avec un
  // indicateur d'annulation pour éviter toute mise à jour sur un composant
  // démonté ou obsolète.
  useEffect(() => {
    if (!adminKey) return;
    let ignore = false;

    (async () => {
      try {
        const data = await listTenants(adminKey);
        if (ignore) return;
        setTenants(data);
        setError(null);
      } catch (err) {
        if (ignore) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger la liste des tenants."
        );
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [adminKey]);

  // Rechargement manuel (bouton "Actualiser") : déclenché par un événement
  // utilisateur, donc mettre à jour l'état directement ici est sûr.
  const reload = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const data = await listTenants(adminKey);
      setTenants(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de charger la liste des tenants."
      );
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  function handleCreated(tenant: Tenant) {
    setTenants((prev) => (prev ? [...prev, tenant] : [tenant]));
  }

  function handleRateLimitSaved(
    tenantId: string,
    perSec: number,
    burst: number
  ) {
    setTenants((prev) =>
      prev
        ? prev.map((t) =>
            t.id === tenantId
              ? { ...t, rate_limit_per_sec: perSec, rate_limit_burst: burst }
              : t
          )
        : prev
    );
  }

  function handleBusinessTypeSaved(tenantId: string, businessType: BusinessType) {
    setTenants((prev) =>
      prev
        ? prev.map((t) =>
            t.id === tenantId ? { ...t, business_type: businessType } : t
          )
        : prev
    );
  }

  function handleActiveSaved(tenantId: string, isActive: boolean) {
    setTenants((prev) =>
      prev
        ? prev.map((t) => (t.id === tenantId ? { ...t, is_active: isActive } : t))
        : prev
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tenants</h1>
          <p className="text-sm text-slate-500">
            Gérez les boutiques ABMCY et suivez leur consommation.
          </p>
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
        >
          {loading ? "Actualisation..." : "Actualiser"}
        </button>
      </div>

      <CreateTenantForm onCreated={handleCreated} />

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && tenants === null ? (
        <LoadingBlock label="Chargement des tenants..." />
      ) : (
        <TenantsTable
          tenants={tenants ?? []}
          onRateLimitSaved={handleRateLimitSaved}
          onBusinessTypeSaved={handleBusinessTypeSaved}
          onActiveSaved={handleActiveSaved}
        />
      )}
    </div>
  );
}
