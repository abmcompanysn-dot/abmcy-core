"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  ApiError,
  listPendingReviews,
  listPublishedReviews,
  type Review,
} from "@/lib/api";
import { CatalogGate } from "@/components/CatalogGate";
import { ReviewCard } from "@/components/ReviewCard";
import { LoadingBlock } from "@/components/Spinner";

function AvisPageContent() {
  const { apiKey } = useAuth();
  const [pending, setPending] = useState<Review[] | null>(null);
  const [published, setPublished] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [settledToken, setSettledToken] = useState(-1);
  const loading = settledToken !== reloadToken;

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    Promise.all([listPendingReviews(apiKey), listPublishedReviews(apiKey)])
      .then(([p, pub]) => {
        if (cancelled) return;
        setPending(p);
        setPublished(pub);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger les avis."
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

  function handlePublished(review: Review) {
    setPending((prev) => prev?.filter((r) => r.id !== review.id) ?? prev);
    setPublished((prev) => (prev ? [review, ...prev] : [review]));
  }

  function handleDeleted(reviewId: string) {
    setPending((prev) => prev?.filter((r) => r.id !== reviewId) ?? prev);
    setPublished((prev) => prev?.filter((r) => r.id !== reviewId) ?? prev);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Avis</h1>
          <p className="text-sm text-slate-500">
            Modérez les avis clients avant leur publication.
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
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-700">
          En attente de modération
        </h2>
        {loading && pending === null ? (
          <LoadingBlock />
        ) : pending && pending.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {pending.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onPublished={handlePublished}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Aucun avis en attente de modération.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-700">Avis publiés</h2>
        {loading && published === null ? (
          <LoadingBlock />
        ) : published && published.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {published.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Aucun avis publié pour le moment.
          </div>
        )}
      </section>
    </div>
  );
}

export default function AvisPage() {
  return (
    <CatalogGate>
      <AvisPageContent />
    </CatalogGate>
  );
}
