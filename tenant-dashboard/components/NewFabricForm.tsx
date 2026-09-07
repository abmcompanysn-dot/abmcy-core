"use client";

import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  ApiError,
  createFabric,
  uploadFabricPhoto,
  type Fabric,
} from "@/lib/api";

export function NewFabricForm({
  onCreated,
}: {
  onCreated: (fabric: Fabric) => void;
}) {
  const { apiKey } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [extraPrice, setExtraPrice] = useState("0");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setName("");
    setDescription("");
    setExtraPrice("0");
    setImageUrl("");
    setError(null);
  }

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
      const fabric = await createFabric(apiKey, {
        name: name.trim(),
        description: description.trim() || undefined,
        extra_price: Math.round(extraPriceNum),
        image_url: imageUrl || undefined,
      });
      onCreated(fabric);
      resetForm();
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible de créer le tissu."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
      >
        + Nouveau tissu
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Nouveau tissu</h2>
        <button
          onClick={() => {
            setOpen(false);
            resetForm();
          }}
          className="text-sm text-slate-400 hover:text-slate-600"
        >
          Annuler
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
              {uploading ? "Envoi..." : "Choisir une photo"}
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

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || uploading}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Création..." : "Créer le tissu"}
        </button>
      </form>
    </div>
  );
}
