"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import {
  deleteArticle,
  publishArticle,
  unpublishArticle,
} from "@/lib/admin-api";
import type { Article } from "@/lib/types";
import { formatDate } from "@/lib/format";

export default function ArticlesTable({
  articles,
  onChanged,
}: {
  articles: Article[];
  onChanged: (article: Article) => void;
}) {
  const { token } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  async function togglePublish(article: Article) {
    if (!token) return;
    setError(null);
    setBusyId(article.id);
    try {
      const updated =
        article.status === "published"
          ? await unpublishArticle(token, article.id)
          : await publishArticle(token, article.id);
      onChanged(updated);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Action impossible."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(article: Article) {
    if (!token) return;
    if (!window.confirm(`Supprimer « ${article.title} » ?`)) return;
    setError(null);
    setBusyId(article.id);
    try {
      await deleteArticle(token, article.id);
      setRemoved((prev) => new Set(prev).add(article.id));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Suppression impossible."
      );
    } finally {
      setBusyId(null);
    }
  }

  const visible = articles.filter((a) => !removed.has(a.id));

  if (visible.length === 0) {
    return (
      <div className="rounded border border-[var(--border-color)] bg-[var(--bg-card)] p-10 text-center text-sm text-[var(--text-muted)]">
        Aucun article pour l&apos;instant.
      </div>
    );
  }

  return (
    <div>
      {error ? (
        <p className="mb-4 rounded border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 px-3 py-2 text-sm text-[var(--text-main)]">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
              <th className="py-2 pr-4">Titre</th>
              <th className="py-2 pr-4">Statut</th>
              <th className="py-2 pr-4">Vues</th>
              <th className="py-2 pr-4">Publié</th>
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {visible.map((article) => (
              <tr
                key={article.id}
                className="border-b border-[var(--border-color)] text-[var(--text-main)]"
              >
                <td className="py-3 pr-4">
                  <Link
                    href={`/admin/${article.id}`}
                    className="hover:text-[var(--accent-red)]"
                  >
                    {article.title}
                  </Link>
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={
                      article.status === "published"
                        ? "text-[var(--accent-gold)]"
                        : "text-[var(--text-muted)]"
                    }
                  >
                    {article.status === "published" ? "Publié" : "Brouillon"}
                  </span>
                </td>
                <td className="py-3 pr-4">{article.view_count}</td>
                <td className="py-3 pr-4">{formatDate(article.published_at)}</td>
                <td className="py-3 pr-4 whitespace-nowrap">
                  <button
                    onClick={() => togglePublish(article)}
                    disabled={busyId === article.id}
                    className="mr-3 text-xs font-semibold text-[var(--accent-red)] disabled:opacity-50"
                  >
                    {article.status === "published" ? "Dépublier" : "Publier"}
                  </button>
                  <button
                    onClick={() => handleDelete(article)}
                    disabled={busyId === article.id}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-red)] disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
