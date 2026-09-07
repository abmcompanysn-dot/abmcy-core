"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError, publishReview, type Review } from "@/lib/api";

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
}: {
  review: Review;
  onPublished?: (review: Review) => void;
}) {
  const { apiKey } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    if (!apiKey) return;
    setError(null);
    setLoading(true);
    try {
      await publishReview(apiKey, review.id);
      onPublished?.({ ...review, is_published: true });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible de publier l'avis."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <Stars rating={review.rating} />
        {!review.is_published && onPublished && (
          <button
            onClick={handlePublish}
            disabled={loading}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Publication..." : "Publier"}
          </button>
        )}
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
