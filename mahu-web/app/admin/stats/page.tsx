"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { listArticlesAdmin } from "@/lib/admin-api";
import type { Article } from "@/lib/types";
import { LoadingBlock } from "@/components/Spinner";

/** Statistiques dérivées des articles déjà chargeables via GET /articles —
 * aucune nouvelle route API, agrégation 100% client comme l'ancien
 * admin.html:1160-1197 (loadStats), qui n'a jamais eu de vraie route
 * stats non plus. */
export default function StatsPage() {
  const { token } = useAuth();
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    listArticlesAdmin(token)
      .then((data) => {
        if (cancelled) return;
        setArticles(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError ? err.message : "Impossible de charger les statistiques."
        );
      })
      .finally(() => {
        if (!cancelled) setSettled(true);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return (
      <main className="mx-auto max-w-[1000px] px-4 py-10 sm:px-8">
        <div className="rounded border border-[var(--accent-red)]/40 bg-[var(--bg-card)] p-6 text-sm text-[var(--text-main)]">
          {error}
        </div>
      </main>
    );
  }

  if (!settled || !articles) {
    return (
      <main className="mx-auto max-w-[1000px] px-4 py-10 sm:px-8">
        <LoadingBlock label="Chargement des statistiques..." />
      </main>
    );
  }

  const totalViews = articles.reduce((sum, a) => sum + a.view_count, 0);
  const published = articles.filter((a) => a.status === "published").length;
  const byCategory = new Map<string, number>();
  for (const a of articles) {
    const key = a.category || "Sans catégorie";
    byCategory.set(key, (byCategory.get(key) ?? 0) + 1);
  }
  const categoryRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <main className="mx-auto max-w-[1000px] px-4 py-10 sm:px-8">
      <h1 className="mb-6 font-[family-name:var(--font-display)] text-2xl text-[var(--text-main)]">
        Statistiques
      </h1>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Articles" value={articles.length} />
        <StatTile label="Publiés" value={published} />
        <StatTile label="Vues totales" value={totalViews} />
        <StatTile label="Catégories" value={byCategory.size} />
      </div>

      <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg text-[var(--text-main)]">
        Répartition par catégorie
      </h2>
      <div className="space-y-2">
        {categoryRows.map(([category, count]) => (
          <div
            key={category}
            className="flex items-center justify-between rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-main)]"
          >
            <span>{category}</span>
            <span className="text-[var(--text-muted)]">{count}</span>
          </div>
        ))}
      </div>
    </main>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-[var(--border-color)] bg-[var(--bg-card)] p-4 text-center">
      <p className="text-2xl font-bold text-[var(--accent-red)]">{value}</p>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
