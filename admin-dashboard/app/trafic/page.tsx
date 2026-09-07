"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError, getTrafficSummary, type TrafficSummary } from "@/lib/api";

export default function TrafficPage() {
  const { adminKey } = useAuth();
  const [summaries, setSummaries] = useState<TrafficSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chargement initial au montage (et si la clé admin change).
  useEffect(() => {
    if (!adminKey) return;
    let ignore = false;

    (async () => {
      try {
        const data = await getTrafficSummary(adminKey);
        if (ignore) return;
        setSummaries(
          [...data].sort((a, b) => b.request_count - a.request_count)
        );
        setError(null);
      } catch (err) {
        if (ignore) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger le trafic."
        );
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [adminKey]);

  // Rechargement manuel (bouton "Actualiser").
  const load = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const data = await getTrafficSummary(adminKey);
      setSummaries(
        [...data].sort((a, b) => b.request_count - a.request_count)
      );
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de charger le trafic."
      );
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Trafic</h1>
          <p className="text-sm text-slate-500">
            Requêtes reçues par tenant au cours des dernières 24 heures.
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

      {loading && summaries === null ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Chargement du trafic...
        </div>
      ) : summaries && summaries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Aucune requête enregistrée au cours des dernières 24 heures.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Tenant</th>
                <th className="px-4 py-3 font-medium">Requêtes (24h)</th>
                <th className="px-4 py-3 font-medium">Erreurs</th>
                <th className="px-4 py-3 font-medium">Requêtes limitées</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summaries?.map((s) => (
                <tr key={s.tenant_id} className="align-middle hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {s.tenant_slug}
                    </div>
                    <div className="font-mono text-xs text-slate-400">
                      {s.tenant_id}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {s.request_count.toLocaleString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        s.error_count > 0
                          ? "font-medium text-red-600"
                          : "text-slate-700"
                      }
                    >
                      {s.error_count.toLocaleString("fr-FR")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        s.rate_limited_count > 0
                          ? "font-medium text-amber-600"
                          : "text-slate-700"
                      }
                    >
                      {s.rate_limited_count.toLocaleString("fr-FR")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/trafic/${encodeURIComponent(s.tenant_id)}`}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      Détails
                    </Link>
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
