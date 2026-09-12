"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { listArticles, ApiError } from "@/lib/api";
import type { Article } from "@/lib/types";
import Hero from "@/components/Hero";
import RegionTabs from "@/components/RegionTabs";
import ArticleGrid from "@/components/ArticleGrid";
import TrendingWidget from "@/components/TrendingWidget";
import { LoadingBlock } from "@/components/Spinner";

function HomeContent() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category") || undefined;
  const region = searchParams.get("region") || undefined;

  const [articles, setArticles] = useState<Article[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "loading" est dérivé de la comparaison avec le dernier filtre traité,
  // plutôt que d'un setState synchrone en tête d'effet (même pattern que
  // tenant-dashboard/app/page.tsx — react-hooks/set-state-in-effect le
  // déconseille : ça déclenche un rendu en cascade évitable).
  const requestKey = `${category ?? ""}|${region ?? ""}`;
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const loading = settledKey !== requestKey;

  useEffect(() => {
    let cancelled = false;

    listArticles({ category, region })
      .then((data) => {
        if (cancelled) return;
        setArticles(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger les articles."
        );
      })
      .finally(() => {
        if (!cancelled) setSettledKey(requestKey);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  if (error) {
    return (
      <main className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8">
        <div className="rounded border border-[var(--accent-red)]/40 bg-[var(--bg-card)] p-6 text-sm text-[var(--text-main)]">
          {error}
        </div>
      </main>
    );
  }

  if (loading || !articles) {
    return (
      <main className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8">
        <LoadingBlock label="Chargement des articles..." />
      </main>
    );
  }

  const featured = articles.find((a) => a.is_featured) ?? articles[0];
  const rest = featured
    ? articles.filter((a) => a.id !== featured.id)
    : articles;

  return (
    <>
      {featured && !category && !region ? <Hero article={featured} /> : null}

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-4 pb-16 sm:px-8 lg:grid-cols-[1fr_350px]">
        <main>
          <RegionTabs />
          <ArticleGrid articles={featured && !category && !region ? rest : articles} />
        </main>

        <aside>
          <TrendingWidget articles={articles} />
        </aside>
      </div>
    </>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8">
          <LoadingBlock label="Chargement..." />
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
