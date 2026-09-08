"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import {
  ApiError,
  listGalleryPhotos,
  type GalleryPhoto,
} from "@/lib/api";
import { CatalogGate } from "@/components/CatalogGate";
import { NewGalleryPhotoForm } from "@/components/NewGalleryPhotoForm";
import { GalleryGrid } from "@/components/GalleryGrid";
import { LoadingBlock } from "@/components/Spinner";

const CATEGORY_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Toutes" },
  { value: "femme", label: "Femme" },
  { value: "homme", label: "Homme" },
  { value: "sur_mesure", label: "Sur mesure" },
  { value: "artisanat", label: "Artisanat" },
];

function GaleriePageContent() {
  const { apiKey } = useAuth();
  const { showToast } = useToast();
  const [photos, setPhotos] = useState<GalleryPhoto[] | null>(null);
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [settledToken, setSettledToken] = useState(-1);
  const loading = settledToken !== reloadToken;

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    listGalleryPhotos(apiKey, category || undefined)
      .then((data) => {
        if (cancelled) return;
        setPhotos(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger la galerie."
        );
      })
      .finally(() => {
        if (!cancelled) setSettledToken(reloadToken);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, category, reloadToken]);

  function reload() {
    setReloadToken((t) => t + 1);
  }

  function handleCreated(photo: GalleryPhoto) {
    setPhotos((prev) => (prev ? [photo, ...prev] : [photo]));
    showToast("Photo ajoutée à la galerie.");
  }

  function handleDeleted(photoId: string) {
    setPhotos((prev) => prev?.filter((p) => p.id !== photoId) ?? prev);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Galerie</h1>
          <p className="text-sm text-slate-500">
            Présentez vos réalisations par catégorie.
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

      <NewGalleryPhotoForm onCreated={handleCreated} />

      <div className="flex flex-wrap gap-1">
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setCategory(f.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              category === f.value
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && photos === null ? (
        <LoadingBlock label="Chargement de la galerie..." />
      ) : (
        <GalleryGrid photos={photos ?? []} onDeleted={handleDeleted} />
      )}
    </div>
  );
}

export default function GaleriePage() {
  return (
    <CatalogGate feature="gallery_enabled">
      <GaleriePageContent />
    </CatalogGate>
  );
}
