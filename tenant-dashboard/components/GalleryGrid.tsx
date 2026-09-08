"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, deleteGalleryPhoto, type GalleryPhoto } from "@/lib/api";

const CATEGORY_LABELS: Record<string, string> = {
  femme: "Femme",
  homme: "Homme",
  sur_mesure: "Sur mesure",
  artisanat: "Artisanat",
};

export function GalleryGrid({
  photos,
  onDeleted,
}: {
  photos: GalleryPhoto[];
  onDeleted?: (photoId: string) => void;
}) {
  const { apiKey } = useAuth();
  const { showToast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(photo: GalleryPhoto) {
    if (!apiKey) return;
    if (!window.confirm("Supprimer définitivement cette photo ?")) return;

    setError(null);
    setDeletingId(photo.id);
    try {
      await deleteGalleryPhoto(apiKey, photo.id);
      onDeleted?.(photo.id);
      showToast("Photo supprimée.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible de supprimer cette photo."
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (photos.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Aucune photo dans cette catégorie pour le moment.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.image_url}
              alt={photo.caption || "Photo de réalisation"}
              className="h-40 w-full object-cover"
            />
            <button
              onClick={() => handleDelete(photo)}
              disabled={deletingId === photo.id}
              className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-red-600 opacity-0 shadow-sm transition-opacity hover:bg-white group-hover:opacity-100 disabled:opacity-50"
            >
              {deletingId === photo.id ? "..." : "Supprimer"}
            </button>
            <div className="space-y-1 p-3">
              {photo.category && (
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  {CATEGORY_LABELS[photo.category] ?? photo.category}
                </span>
              )}
              {photo.caption && (
                <p className="text-xs text-slate-500">{photo.caption}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
