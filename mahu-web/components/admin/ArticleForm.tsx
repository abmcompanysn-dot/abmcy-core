"use client";

import Image from "next/image";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import {
  createArticle,
  updateArticle,
  uploadImage,
  type ArticleInput,
} from "@/lib/admin-api";
import type { Article } from "@/lib/types";

const CATEGORIES = ["Politique", "Économie", "Tech", "Sport", "Culture"];
const REGIONS = ["Ouest", "Est", "Nord", "Centrale"];

/** Formulaire de création OU d'édition d'un article — même composant pour
 * les deux cas, comme tenant-dashboard/components/EditProductForm.tsx :
 * l'upload de l'image de couverture se fait dès la sélection du fichier
 * (POST /uploads/image), pas au submit du formulaire. */
export default function ArticleForm({
  article,
}: {
  article?: Article;
}) {
  const { token } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(article?.title ?? "");
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? "");
  const [body, setBody] = useState(article?.body ?? "");
  const [category, setCategory] = useState(article?.category ?? "");
  const [region, setRegion] = useState(article?.region ?? "");
  const [isFeatured, setIsFeatured] = useState(article?.is_featured ?? false);
  const [coverImageUrl, setCoverImageUrl] = useState(
    article?.cover_image_url ?? ""
  );
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setError(null);
    setUploading(true);
    try {
      const uploaded = await uploadImage(token, file);
      setCoverImageUrl(uploaded.url);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible d'envoyer l'image."
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);

    if (!title.trim() || !body.trim()) {
      setError("Titre et corps de l'article sont obligatoires.");
      return;
    }

    const input: ArticleInput = {
      title: title.trim(),
      excerpt: excerpt.trim(),
      body: body.trim(),
      category: category.trim(),
      region: region.trim(),
      cover_image_url: coverImageUrl,
      is_featured: isFeatured,
    };

    setLoading(true);
    try {
      const saved = article
        ? await updateArticle(token, article.id, input)
        : await createArticle(token, input);
      router.push(`/admin/${saved.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible d'enregistrer l'article."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--text-muted)]">
          Image de couverture
        </label>
        <div className="flex items-center gap-4">
          {coverImageUrl ? (
            <div className="relative h-20 w-32 overflow-hidden rounded border border-[var(--border-color)]">
              <Image src={coverImageUrl} alt="" fill className="object-cover" />
            </div>
          ) : null}
          <label className="flex h-20 w-32 cursor-pointer items-center justify-center rounded border border-dashed border-[var(--border-color)] text-xs text-[var(--text-muted)] hover:border-[var(--accent-red)]">
            {uploading ? "…" : coverImageUrl ? "Changer" : "+ Ajouter"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploading || loading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">
          Titre *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={loading}
          className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-main)]"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">
            Catégorie
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={loading}
            className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-main)]"
          >
            <option value="">—</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">
            Région
          </label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            disabled={loading}
            className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-main)]"
          >
            <option value="">—</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">
          Extrait
        </label>
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={2}
          disabled={loading}
          className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-main)]"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">
          Corps de l&apos;article *
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          disabled={loading}
          className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-main)]"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--text-main)]">
        <input
          type="checkbox"
          checked={isFeatured}
          onChange={(e) => setIsFeatured(e.target.checked)}
          disabled={loading}
        />
        Mise en avant (hero de la page d&apos;accueil)
      </label>

      {error ? (
        <p className="rounded border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 px-3 py-2 text-sm text-[var(--text-main)]">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-[var(--accent-red)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
