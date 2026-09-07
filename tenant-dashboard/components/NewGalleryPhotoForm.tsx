"use client";

import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  ApiError,
  addGalleryPhoto,
  uploadImage,
  type GalleryCategory,
  type GalleryPhoto,
} from "@/lib/api";

const CATEGORIES: { value: GalleryCategory; label: string }[] = [
  { value: "femme", label: "Femme" },
  { value: "homme", label: "Homme" },
  { value: "sur_mesure", label: "Sur mesure" },
  { value: "artisanat", label: "Artisanat" },
];

export function NewGalleryPhotoForm({
  onCreated,
}: {
  onCreated: (photo: GalleryPhoto) => void;
}) {
  const { apiKey } = useAuth();
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState<GalleryCategory>("sur_mesure");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(files: FileList | null) {
    const file = files?.[0];
    if (!file || !apiKey) return;
    setError(null);
    setUploading(true);
    try {
      const result = await uploadImage(apiKey, file);
      setImageUrl(result.url);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible d'envoyer la photo."
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!apiKey) return;
    setError(null);

    if (!imageUrl) {
      setError("Veuillez d'abord envoyer une photo.");
      return;
    }

    setLoading(true);
    try {
      const photo = await addGalleryPhoto(apiKey, {
        image_url: imageUrl,
        category,
        caption: caption.trim() || undefined,
      });
      onCreated(photo);
      setImageUrl("");
      setCaption("");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible d'ajouter la photo à la galerie."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        Ajouter une photo
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            disabled={loading || uploading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || uploading}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            {uploading ? "Envoi..." : "Choisir une photo"}
          </button>
          {imageUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imageUrl}
              alt="Aperçu"
              className="h-12 w-12 rounded-md border border-slate-200 object-cover"
            />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Catégorie
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as GalleryCategory)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Légende (optionnel)
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || uploading || !imageUrl}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Ajout..." : "Ajouter à la galerie"}
        </button>
      </form>
    </div>
  );
}
