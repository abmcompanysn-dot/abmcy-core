// Client centralisant les appels vers le backend ABMCY Core. Contrairement
// à tenant-dashboard/admin-dashboard, ce site est public : aucune requête
// ici n'envoie de clé API ni de JWT — tout passe par les routes
// /public/{tenantSlug}/articles* (voir internal/httpserver/content_handlers.go),
// les seules du backend accessibles sans authentification.
import type { Article, ArticleListFilter } from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  "https://api.abmcy.com";

export const TENANT_SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG || "mahu";

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

/** Erreur levée par le client API, avec le message lisible du backend. */
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      0,
      "Impossible de contacter le serveur. Vérifiez votre connexion."
    );
  }

  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      // corps non-JSON ou vide
    }
    throw new ApiError(
      res.status,
      body?.error?.message || `Erreur inattendue (HTTP ${res.status}).`,
      body?.error?.code
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

function buildQuery(filter?: ArticleListFilter): string {
  if (!filter) return "";
  const params = new URLSearchParams();
  if (filter.category) params.set("category", filter.category);
  if (filter.region) params.set("region", filter.region);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** GET /public/{tenantSlug}/articles — liste des articles publiés. */
export function listArticles(filter?: ArticleListFilter): Promise<Article[]> {
  return request<Article[]>(
    `/public/${TENANT_SLUG}/articles${buildQuery(filter)}`
  );
}

/** GET /public/{tenantSlug}/articles/{id} — un article publié. */
export function getArticle(id: string): Promise<Article> {
  return request<Article>(`/public/${TENANT_SLUG}/articles/${id}`);
}

/** POST /public/{tenantSlug}/articles/{id}/view — incrémente le compteur
 * de vues (fire-and-forget côté appelant, voir content.Service.IncrementView
 * côté backend — pas de garantie anti-abus dans cette première version). */
export function incrementView(id: string): Promise<void> {
  return request<void>(`/public/${TENANT_SLUG}/articles/${id}/view`, {
    method: "POST",
  });
}
