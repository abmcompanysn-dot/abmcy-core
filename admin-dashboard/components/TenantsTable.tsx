import Link from "next/link";
import { useMemo, useState } from "react";
import type { BusinessType, Tenant } from "@/lib/api";
import { StorageBar } from "./StorageBar";
import { RateLimitEditor } from "./RateLimitEditor";
import { BusinessTypeEditor } from "./BusinessTypeEditor";
import { CatalogToggle } from "./CatalogToggle";
import { TenantActiveToggle } from "./TenantActiveToggle";
import { TenantDangerActions } from "./TenantDangerActions";

export function TenantsTable({
  tenants,
  onRateLimitSaved,
  onBusinessTypeSaved,
  onActiveSaved,
  onDeleted,
}: {
  tenants: Tenant[];
  onRateLimitSaved?: (tenantId: string, perSec: number, burst: number) => void;
  onBusinessTypeSaved?: (tenantId: string, businessType: BusinessType) => void;
  onActiveSaved?: (tenantId: string, isActive: boolean) => void;
  onDeleted?: (tenantId: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) => {
      const status = t.is_active ? "actif" : "inactif";
      return (
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.plan.toLowerCase().includes(q) ||
        status.includes(q)
      );
    });
  }, [tenants, search]);

  if (tenants.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        Aucun tenant pour le moment. Créez-en un avec le formulaire ci-dessus.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, slug, plan ou statut..."
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:w-72"
        />
        {search && (
          <span className="text-xs text-slate-500">
            {filtered.length} / {tenants.length} tenant(s)
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Aucun tenant ne correspond à &quot;{search}&quot;.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Stockage</th>
                <th className="px-4 py-3 font-medium">Quota email / jour</th>
                <th className="px-4 py-3 font-medium">Limite de trafic</th>
                <th className="px-4 py-3 font-medium">Type de commerce</th>
                <th className="px-4 py-3 font-medium">Catalogue</th>
                <th className="px-4 py-3 font-medium">Profil</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t) => (
                <tr key={t.id} className="align-middle hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {t.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {t.slug}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                      {t.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <TenantActiveToggle
                      tenantId={t.id}
                      isActive={t.is_active}
                      onSaved={(isActive) => onActiveSaved?.(t.id, isActive)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <StorageBar
                      used={t.storage_used_bytes}
                      limit={t.storage_limit_bytes}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {t.email_quota_per_day.toLocaleString("fr-FR")} / jour
                  </td>
                  <td className="px-4 py-3">
                    <RateLimitEditor
                      tenantId={t.id}
                      perSec={t.rate_limit_per_sec}
                      burst={t.rate_limit_burst}
                      onSaved={(perSec, burst) =>
                        onRateLimitSaved?.(t.id, perSec, burst)
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <BusinessTypeEditor
                      tenantId={t.id}
                      businessType={t.business_type}
                      onSaved={(businessType) =>
                        onBusinessTypeSaved?.(t.id, businessType)
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <CatalogToggle tenantId={t.id} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/tenants/${t.id}`}
                      className="text-sm font-medium text-indigo-600 hover:underline"
                    >
                      Voir / modifier
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <TenantDangerActions
                      tenantId={t.id}
                      tenantName={t.name}
                      onDeleted={(tenantId) => onDeleted?.(tenantId)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
