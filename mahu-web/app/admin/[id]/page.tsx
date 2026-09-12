"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { getArticleAdmin } from "@/lib/admin-api";
import type { Article } from "@/lib/types";
import ArticleForm from "@/components/admin/ArticleForm";
import VideoGenerator from "@/components/admin/VideoGenerator";
import { LoadingBlock } from "@/components/Spinner";

export default function EditArticlePage() {
  const { token } = useAuth();
  const params = useParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    getArticleAdmin(token, params.id)
      .then((data) => {
        if (cancelled) return;
        setArticle(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError ? err.message : "Impossible de charger cet article."
        );
      })
      .finally(() => {
        if (!cancelled) setSettled(true);
      });

    return () => {
      cancelled = true;
    };
  }, [token, params.id]);

  if (error) {
    return (
      <main className="mx-auto max-w-[700px] px-4 py-10 sm:px-8">
        <div className="rounded border border-[var(--accent-red)]/40 bg-[var(--bg-card)] p-6 text-sm text-[var(--text-main)]">
          {error}
        </div>
      </main>
    );
  }

  if (!settled || !article) {
    return (
      <main className="mx-auto max-w-[700px] px-4 py-10 sm:px-8">
        <LoadingBlock label="Chargement de l'article..." />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[700px] space-y-10 px-4 py-10 sm:px-8">
      <div>
        <h1 className="mb-6 font-[family-name:var(--font-display)] text-2xl text-[var(--text-main)]">
          Modifier l&apos;article
        </h1>
        <ArticleForm article={article} />
      </div>

      <VideoGenerator article={article} />
    </main>
  );
}
