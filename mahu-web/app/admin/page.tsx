"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { listArticlesAdmin } from "@/lib/admin-api";
import type { Article } from "@/lib/types";
import { downloadArticlesCSV } from "@/lib/articleHelpers";
import ArticlesTable from "@/components/admin/ArticlesTable";
import { LoadingBlock } from "@/components/Spinner";

export default function AdminArticlesPage() {
  const { token } = useAuth();
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "loading" dérivé d'une comparaison de tokens plutôt que d'un setState
  // synchrone en tête d'effet (react-hooks/set-state-in-effect) — même
  // pattern que mahu-web/app/page.tsx et tenant-dashboard/app/page.tsx.
  const [settled, setSettled] = useState(false);
  const loading = !settled;

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
          err instanceof ApiError ? err.message : "Impossible de charger les articles."
        );
      })
      .finally(() => {
        if (!cancelled) setSettled(true);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  function handleChanged(updated: Article) {
    setArticles((prev) =>
      prev ? prev.map((a) => (a.id === updated.id ? updated : a)) : prev
    );
  }

  return (
    <main className="mx-auto max-w-[1000px] px-4 py-10 sm:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--text-main)]">
          Articles
        </h1>
        {articles && articles.length > 0 ? (
          <button
            onClick={() => downloadArticlesCSV(articles)}
            className="rounded border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-muted)]"
          >
            ⬇ Exporter CSV
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded border border-[var(--accent-red)]/40 bg-[var(--bg-card)] p-6 text-sm text-[var(--text-main)]">
          {error}
        </div>
      ) : loading || !articles ? (
        <LoadingBlock label="Chargement des articles..." />
      ) : (
        <ArticlesTable articles={articles} onChanged={handleChanged} />
      )}
    </main>
  );
}
