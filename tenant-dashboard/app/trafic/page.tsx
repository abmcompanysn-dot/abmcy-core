"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  ApiError,
  getTrafficSummary,
  getTrafficTopRoutes,
  type RoutePopularity,
  type TrafficSummary,
} from "@/lib/api";

export default function TrafficPage() {
  const { apiKey } = useAuth();
  const [summary, setSummary] = useState<TrafficSummary | null>(null);
  const [topRoutes, setTopRoutes] = useState<RoutePopularity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [settledToken, setSettledToken] = useState(-1);
  const loading = settledToken !== reloadToken;

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    Promise.all([getTrafficSummary(apiKey), getTrafficTopRoutes(apiKey)])
      .then(([summaryResult, topRoutesResult]) => {
        if (cancelled) return;
        setSummary(summaryResult);
        setTopRoutes(topRoutesResult);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError ? err.message : "Impossible de charger le trafic."
        );
      })
      .finally(() => {
        if (!cancelled) setSettledToken(reloadToken);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, reloadToken]);

  function reload() {
    setReloadToken((t) => t + 1);
  }

  const maxRequestCount = Math.max(1, ...topRoutes.map((r) => r.request_count));

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Trafic</h1>
          <p className="text-sm text-slate-500">
            Activité de votre intégration sur les dernières 24 heures.
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

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Requêtes (24h)
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {summary ? summary.request_count.toLocaleString("fr-FR") : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Erreurs serveur
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {summary ? summary.error_count.toLocaleString("fr-FR") : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Requêtes limitées
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {summary ? summary.rate_limited_count.toLocaleString("fr-FR") : "—"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium text-slate-700">
          Services les plus sollicités
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Les routes de votre intégration les plus utilisées sur les
          dernières 24 heures.
        </p>

        {!loading && topRoutes.length === 0 && (
          <p className="mt-4 text-sm text-slate-400">
            Aucune requête enregistrée sur cette période.
          </p>
        )}

        <div className="mt-4 space-y-3">
          {topRoutes.map((route) => (
            <div key={`${route.method} ${route.path}`}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-mono text-slate-700">
                  <span className="text-slate-400">{route.method}</span>{" "}
                  {route.path}
                </span>
                <span className="tabular-nums text-slate-500">
                  {route.request_count.toLocaleString("fr-FR")}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                <div
                  className="h-1.5 rounded-full bg-indigo-500"
                  style={{
                    width: `${(route.request_count / maxRequestCount) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
