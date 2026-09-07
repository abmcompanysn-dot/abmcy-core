// Client centralisant tous les appels vers le backend ABMCY Core.
// Toutes les requêtes admin injectent le header X-Admin-Key, lu depuis
// le localStorage du navigateur (jamais stocké en dur dans le code).

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  "https://api.abmcy.com";

const ADMIN_KEY_STORAGE_KEY = "abmcy_admin_key";

/** Lit la clé admin stockée localement (uniquement côté navigateur). */
export function getStoredAdminKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Sauvegarde la clé admin dans le localStorage du navigateur. */
export function storeAdminKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ADMIN_KEY_STORAGE_KEY, key);
  } catch {
    // localStorage indisponible (mode privé strict, etc.) — on ignore.
  }
}

/** Supprime la clé admin stockée localement (déconnexion). */
export function clearStoredAdminKey(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  api_key_public: string;
  plan: string;
  storage_limit_bytes: number;
  storage_used_bytes: number;
  email_quota_per_day: number;
  is_active: boolean;
}

export interface CreateTenantResponse {
  tenant: Tenant;
  api_key_secret: string;
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
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

async function request<T>(
  path: string,
  adminKey: string,
  init?: RequestInit
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Key": adminKey,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      0,
      "Impossible de contacter le serveur. Vérifiez l'URL de l'API et votre connexion."
    );
  }

  if (res.status === 403 || res.status === 401) {
    throw new ApiError(
      res.status,
      "Clé admin invalide ou accès refusé.",
      "forbidden"
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

/** GET /admin/tenants — liste tous les tenants. */
export function listTenants(adminKey: string): Promise<Tenant[]> {
  return request<Tenant[]>("/admin/tenants", adminKey, { method: "GET" });
}

/** POST /admin/tenants — crée un nouveau tenant. */
export function createTenant(
  adminKey: string,
  input: { name: string; slug: string }
): Promise<CreateTenantResponse> {
  return request<CreateTenantResponse>("/admin/tenants", adminKey, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** GET /health — simple vérification de disponibilité de l'API. */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
