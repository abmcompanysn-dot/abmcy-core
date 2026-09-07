"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError, getTenantTraffic, type RecentRequest } from "@/lib/api";

function StatusCodeBadge({ status }: { status: number }) {
  const classes =
    status >= 500
      ? "bg-red-50 text-red-700"
      : status >= 400
        ? "bg-amber-50 text-amber-700"
        : status >= 200 && status < 300
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-600";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}
    >
      {status}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR");
  } catch {
    return iso;
  }
}

export default function TenantTrafficDetailPage() {
  const { adminKey } = useAuth();
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;

  const [requests, setRequests] = useState<RecentRequest[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chargement initial au montage (et si la clé admin ou le tenant change).
  useEffect(() => {
    if (!adminKey || !tenantId) return;
    let ignore = false;

    (async () => {
      try {
        const data = await getTenantTraffic(adminKey, tenantId);
        if (ignore) return;
        setRequests(data);
        setError(null);
      } catch (err) {
        if (ignore) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger les requêtes de ce tenant."
        );
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [adminKey, tenantId]);

  // Rechargement manuel (bouton "Actualiser").
  const load = useCallback(async () => {
    if (!adminKey || !tenantId) return;
    setLoading(true);
    try {
      const data = await getTenantTraffic(adminKey, tenantId);
      setRequests(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de charger les requêtes de ce tenant."
      );
    } finally {
      setLoading(false);
    }
  }, [adminKey, tenantId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/trafic"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            ← Retour au trafic
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Détail du trafic
          </h1>
          <p className="font-mono text-xs text-slate-400">{tenantId}</p>
          <p className="mt-1 text-sm text-slate-500">
            Les 100 dernières requêtes reçues pour ce tenant.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
        >
          {loading ? "Actualisation..." : "Actualiser"}
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && requests === null ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Chargement des requêtes...
        </div>
      ) : requests && requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Aucune requête enregistrée pour ce tenant.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Méthode</th>
                <th className="px-4 py-3 font-medium">Chemin</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Durée</th>
                <th className="px-4 py-3 font-medium">Limité</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests?.map((r, i) => (
                <tr key={i} className="align-middle hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700">
                    {r.method}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {r.path}
                  </td>
                  <td className="px-4 py-3">
                    <StatusCodeBadge status={r.status_code} />
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.duration_ms.toLocaleString("fr-FR")} ms
                  </td>
                  <td className="px-4 py-3">
                    {r.rate_limited ? (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        Limité
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDate(r.created_at)}
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
