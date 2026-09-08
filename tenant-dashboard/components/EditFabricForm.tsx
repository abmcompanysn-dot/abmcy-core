"use client";

import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import {
  ApiError,
  updateFabric,
  uploadFabricPhoto,
  type Fabric,
} from "@/lib/api";

/** Formulaire d'édition d'un tissu existant, en modal — même structure
 * que EditProductForm (internal/catalog/fabrics.go Update() suit
 * exactement le même modèle PATCH que products). */
export function EditFabricForm({
  fabric,
  onUpdated,
  onClose,
}: {
  fabric: Fabric;
  onUpdated: (fabric: Fabric) => void;
  onClose: () => void;
}) {
  const { apiKey } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(fabric.name);
  const [description, setDescription] = useState(fabric.description ?? "");
  const [extraPrice, setExtraPrice] = useState(String(fabric.extra_price));
  const [imageUrl, setImageUrl] = useState(fabric.image_url ?? "");
  const [isActive, setIsActive] = useState(fabric.is_active);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelect(files: FileList | null) {
    const file = files?.[0];
    if (!file || !apiKey) return;
    setError(null);
    setUploading(true);
    try {
      const { url } = await uploadFabricPhoto(apiKey, file);
      setImageUrl(url);
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

    if (!name.trim()) {
      setError("Le nom du tissu est obligatoire.");
      return;
    }
    const extraPriceNum = Number(extraPrice || "0");
    if (!Number.isFinite(extraPriceNum) || extraPriceNum < 0) {
      setError("Le supplément de prix doit être un nombre positif ou nul.");
      return;
    }

    setLoading(true);
    try {
      const updated = await updateFabric(apiKey, fabric.id, {
        name: name.trim(),
        description: description.trim(),
        extra_price: Math.round(extraPriceNum),
        image_url: imageUrl,
        is_active: isActive,
      });
      onUpdated(updated);
      showToast("Tissu mis à jour avec succès.");
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible de modifier le tissu."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Modifier le tissu
          </h2>
          <button
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            Fermer
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Nom *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Supplément de prix (FCFA)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={extraPrice}
                onChange={(e) => setExtraPrice(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Photo du tissu
            </label>
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
                {uploading ? "Envoi..." : "Changer la photo"}
              </button>
              {imageUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={imageUrl}
                  alt="Aperçu du tissu"
                  className="h-12 w-12 rounded-md border border-slate-200 object-cover"
                />
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              disabled={loading}
            />
            Actif (visible dans le catalogue)
          </label>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading || uploading}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Enregistrement..." : "Enregistrer les modifications"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-slate-500 hover:text-slate-700"
              disabled={loading}
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
