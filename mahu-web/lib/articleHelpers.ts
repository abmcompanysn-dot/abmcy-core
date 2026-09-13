// Fonctions utilitaires 100% client, portées de MAHU-NEW/admin.html —
// aucune ne parle au backend.
import type { Article } from "./types";

const CATEGORIES_STORAGE_KEY = "mahu-categories";
export const DEFAULT_CATEGORIES = [
  "Politique",
  "Économie",
  "Tech",
  "Sport",
  "Culture",
  "International",
  "Business",
];

/** Catégories personnalisées ajoutées depuis l'admin, en plus des
 * catégories par défaut — stockées localement (portage de
 * admin.html:648-666), pas de table de référence côté backend. */
export function getStoredCategories(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CATEGORIES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addStoredCategory(category: string): void {
  if (typeof window === "undefined") return;
  const trimmed = category.trim();
  if (!trimmed) return;
  const current = getStoredCategories();
  if (current.includes(trimmed)) return;
  try {
    window.localStorage.setItem(
      CATEGORIES_STORAGE_KEY,
      JSON.stringify([...current, trimmed])
    );
  } catch {
    // localStorage indisponible — l'ajout reste seulement pour la session.
  }
}

/** Suggestion de tags par extraction de mots-clés fréquents (>4 lettres)
 * dans le titre + l'extrait — pas une vraie IA, portage direct de
 * admin.html:677-689. Renvoie jusqu'à 6 mots-clés, triés par fréquence. */
export function suggestTags(title: string, excerpt: string): string[] {
  const text = `${title} ${excerpt}`.toLowerCase();
  const words = text
    .replace(/[.,;:()]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 4);
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w]) => w);
}

/** Sérialise une liste d'articles en CSV et déclenche le téléchargement —
 * portage de admin.html:691-705. Purement dérivé des données déjà en
 * mémoire, aucun nouvel appel réseau. */
export function downloadArticlesCSV(articles: Article[]): void {
  if (articles.length === 0) return;
  const headers = Object.keys(articles[0]) as (keyof Article)[];
  const rows = [headers.join(",")];
  for (const a of articles) {
    const line = headers
      .map((h) => {
        const value = a[h];
        const str = value !== undefined && value !== null ? String(value) : "";
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(",");
    rows.push(line);
  }
  const csv = rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mahu_articles_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
