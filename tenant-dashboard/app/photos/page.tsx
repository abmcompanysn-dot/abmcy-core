"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError, uploadImage, type UploadedImage } from "@/lib/api";
import { formatBytes } from "@/lib/format";

interface UploadedEntry extends UploadedImage {
  previewUrl: string;
}

export default function PhotosPage() {
  const { apiKey } = useAuth();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadedEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const doUpload = useCallback(
    async (file: File) => {
      if (!apiKey) return;
      setError(null);
      setUploading(true);
      const previewUrl = URL.createObjectURL(file);
      try {
        const result = await uploadImage(apiKey, file);
        setUploads((prev) => [{ ...result, previewUrl }, ...prev]);
      } catch (err) {
        if (err instanceof ApiError && err.status === 413) {
          setError(
            "Quota de stockage dépassé. Supprimez des photos existantes ou mettez à niveau votre forfait pour continuer."
          );
        } else if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Impossible d'envoyer l'image.");
        }
        URL.revokeObjectURL(previewUrl);
      } finally {
        setUploading(false);
      }
    },
    [apiKey]
  );

  function handleFileSelect(files: FileList | null) {
    const file = files?.[0];
    if (file) doUpload(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) doUpload(file);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Photos</h1>
        <p className="text-sm text-slate-500">
          Envoyez des photos de produits ou de tissus. Elles seront hébergées
          et accessibles via une URL publique.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          dragging
            ? "border-indigo-400 bg-indigo-50"
            : "border-slate-300 bg-white hover:border-slate-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        <p className="text-sm font-medium text-slate-700">
          {uploading
            ? "Envoi en cours..."
            : "Glissez-déposez une image ici, ou cliquez pour en choisir une"}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Formats image courants, 25 Mo maximum par fichier.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {uploads.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-slate-700">
            Photos envoyées
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {uploads.map((upload) => (
              <div
                key={upload.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={upload.url}
                  alt="Photo envoyée"
                  className="h-32 w-full object-cover"
                />
                <div className="space-y-1 p-3">
                  <a
                    href={upload.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-xs text-indigo-600 underline"
                  >
                    {upload.url}
                  </a>
                  <p className="text-xs text-slate-400">
                    {formatBytes(upload.size_bytes)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
