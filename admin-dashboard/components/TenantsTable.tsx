import type { Tenant } from "@/lib/api";
import { StorageBar } from "./StorageBar";
import { StatusBadge } from "./StatusBadge";
import { RateLimitEditor } from "./RateLimitEditor";

export function TenantsTable({
  tenants,
  onRateLimitSaved,
}: {
  tenants: Tenant[];
  onRateLimitSaved?: (tenantId: string, perSec: number, burst: number) => void;
}) {
  if (tenants.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        Aucun tenant pour le moment. Créez-en un avec le formulaire ci-dessus.
      </div>
    );
  }

  return (
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
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tenants.map((t) => (
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
                <StatusBadge active={t.is_active} />
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
