"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getArticle, incrementView, ApiError } from "@/lib/api";
import type { Article } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { LoadingBlock } from "@/components/Spinner";

export default function ArticlePage() {
  const params = useParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);
  const viewedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getArticle(params.id)
      .then((data) => {
        if (cancelled) return;
        setArticle(data);
        if (!viewedRef.current) {
          viewedRef.current = true;
          incrementView(params.id).catch(() => {
            // best-effort — un compteur de vues raté ne doit jamais
            // empêcher la lecture de l'article.
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger cet article."
        );
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-8">
        <p className="mb-6 text-sm text-[var(--text-muted)]">{error}</p>
        <Link href="/" className="text-sm text-[var(--accent-red)]">
          ← Retour à l&apos;accueil
        </Link>
      </main>
    );
  }

  if (!article) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
        <LoadingBlock label="Chargement de l'article..." />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-[var(--text-muted)] no-underline hover:text-[var(--accent-red)]"
      >
        ← Retour à l&apos;accueil
      </Link>

      {article.category ? (
        <span className="mb-3 inline-block bg-[var(--accent-red)] px-3 py-1 text-[0.7rem] font-bold tracking-wide text-white uppercase">
          {article.category}
        </span>
      ) : null}

      <h1 className="mb-4 font-[family-name:var(--font-display)] text-3xl leading-tight text-[var(--text-main)] sm:text-5xl">
        {article.title}
      </h1>

      <div className="mb-6 flex items-center gap-4 text-xs text-[var(--text-muted)]">
        <span>{formatDate(article.published_at)}</span>
        <span>{article.view_count} vues</span>
        {article.region ? <span>{article.region}</span> : null}
      </div>

      {article.cover_image_url ? (
        <div className="relative mb-8 h-[320px] w-full overflow-hidden sm:h-[420px]">
          <Image
            src={article.cover_image_url}
            alt={article.title}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
            priority
          />
        </div>
      ) : null}

      <div className="space-y-4 text-lg leading-relaxed whitespace-pre-line text-[var(--text-main)]">
        {article.body}
      </div>
    </main>
  );
}
