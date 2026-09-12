// Client API pour l'interface d'administration MAHU (/admin/*) — séparé de
// lib/api.ts (site public, sans authentification) : toutes les fonctions ici
// nécessitent un JWT staff (Authorization: Bearer), obtenu via staffLogin.
import { API_URL, TENANT_SLUG, ApiError } from "./api";
import type { Article, ArticleListFilter } from "./types";

const TOKEN_STORAGE_KEY = "mahu_staff_token";

/** Lit le JWT staff stocké localement (uniquement côté navigateur). */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // localStorage indisponible (mode privé strict, etc.) — on ignore.
  }
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

async function request<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        Authorization: `Bearer ${token}`,
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

  if (res.status === 403 || res.status === 401) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      // corps non-JSON ou vide
    }
    throw new ApiError(
      res.status,
      body?.error?.message || "Session expirée. Merci de vous reconnecter.",
      body?.error?.code || "forbidden"
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

/** POST /auth/login — connexion staff (email/mot de passe), tenant fixé à
 * mahu (voir NEXT_PUBLIC_TENANT_SLUG). Renvoie le JWT brut. */
export async function staffLogin(
  email: string,
  password: string
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_slug: TENANT_SLUG, email, password }),
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
      body?.error?.message || "Email ou mot de passe incorrect.",
      body?.error?.code
    );
  }

  const { token } = (await res.json()) as { token: string };
  return token;
}

/** POST /auth/logout — révoque le JWT côté serveur (vrai logout). */
export function staffLogout(token: string): Promise<void> {
  return request<void>("/auth/logout", token, { method: "POST" });
}

/** GET /articles — liste tous les articles du tenant (brouillons compris),
 * contrairement à listArticles (lib/api.ts) qui ne montre que les publiés. */
export function listArticlesAdmin(
  token: string,
  filter?: ArticleListFilter
): Promise<Article[]> {
  const params = new URLSearchParams();
  if (filter?.category) params.set("category", filter.category);
  if (filter?.region) params.set("region", filter.region);
  const qs = params.toString();
  return request<Article[]>(`/articles${qs ? `?${qs}` : ""}`, token);
}

export function getArticleAdmin(token: string, id: string): Promise<Article> {
  return request<Article>(`/articles/${id}`, token);
}

export interface ArticleInput {
  title: string;
  excerpt: string;
  body: string;
  category: string;
  region: string;
  cover_image_url: string;
  is_featured: boolean;
}

export function createArticle(
  token: string,
  input: ArticleInput
): Promise<Article> {
  return request<Article>("/articles", token, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateArticle(
  token: string,
  id: string,
  input: Partial<ArticleInput>
): Promise<Article> {
  return request<Article>(`/articles/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteArticle(token: string, id: string): Promise<void> {
  return request<void>(`/articles/${id}`, token, { method: "DELETE" });
}

export function publishArticle(token: string, id: string): Promise<Article> {
  return request<Article>(`/articles/${id}/publish`, token, {
    method: "POST",
  });
}

export function unpublishArticle(token: string, id: string): Promise<Article> {
  return request<Article>(`/articles/${id}/unpublish`, token, {
    method: "POST",
  });
}

export interface UploadedImage {
  id: string;
  url: string;
  size_bytes: number;
}

/** POST /uploads/image — image "libre" (pas de product_id : une image de
 * couverture d'article n'est pas liée à un produit du catalogue). */
export function uploadImage(
  token: string,
  file: File
): Promise<UploadedImage> {
  const form = new FormData();
  form.append("image", file);
  return request<UploadedImage>("/uploads/image", token, {
    method: "POST",
    body: form,
  });
}
