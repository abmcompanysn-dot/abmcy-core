"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, deleteReview, publishReview, type Review } from "@/lib/api";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500" aria-label={`${rating} sur 5`}>
      {"★".repeat(Math.max(0, Math.min(5, rating)))}
      {"☆".repeat(5 - Math.max(0, Math.min(5, rating)))}
    </span>
  );
}

export function ReviewCard({
  review,
  onPublished,
  onDeleted,
}: {
  review: Review;
  onPublished?: (review: Review) => void;
  onDeleted?: (reviewId: string) => void;
}) {
  const { apiKey } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    if (!apiKey) return;
    setError(null);
    setLoading(true);
    try {
      await publishReview(apiKey, review.id);
      onPublished?.({ ...review, is_published: true });
      showToast("Avis publié.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible de publier l'avis."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!apiKey) return;
    const confirmMessage = review.is_published
      ? "Retirer définitivement cet avis publié ?"
      : "Rejeter et supprimer définitivement cet avis ?";
    if (!window.confirm(confirmMessage)) return;

    setError(null);
    setLoading(true);
    try {
      await deleteReview(apiKey, review.id);
      onDeleted?.(review.id);
      showToast("Avis rejeté.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible de rejeter l'avis."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <Stars rating={review.rating} />
        <div className="flex items-center gap-2">
          {!review.is_published && onPublished && (
            <button
              onClick={handlePublish}
              disabled={loading}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "..." : "Publier"}
            </button>
          )}
          {onDeleted && (
            <button
              onClick={handleReject}
              disabled={loading}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {review.is_published ? "Retirer" : "Rejeter"}
            </button>
          )}
        </div>
      </div>
      {review.comment && (
        <p className="mt-2 text-sm text-slate-700">{review.comment}</p>
      )}
      {review.photo_urls && review.photo_urls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.photo_urls.map((url) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={url}
              src={url}
              alt="Photo jointe à l'avis"
              className="h-16 w-16 rounded-md border border-slate-200 object-cover"
            />
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
