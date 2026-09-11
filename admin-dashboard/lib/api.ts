// Client centralisant tous les appels vers le backend ABMCY Core.
// Toutes les requêtes admin injectent une credential lue depuis le
// localStorage du navigateur (jamais stockée en dur dans le code) : soit
// un JWT obtenu via POST /admin/auth/login (compte email/mot de passe),
// envoyé en "Authorization: Bearer ...", soit la clé X-Admin-Key statique
// historique (secours bootstrap tant qu'aucun compte n'existe encore).
// Un JWT contient toujours exactement deux points — même heuristique que
// httpserver.staffAuth côté backend pour distinguer les deux formats.

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  "https://api.abmcy.com";

/** Documentation d'intégration API — page du site vitrine, pas un artifact. */
export const DOCS_URL = "https://cors.abmcy.com/docs";

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

/** Type de commerce d'un tenant — indique la forme des attributs produits. */
export type BusinessType =
  | "couture_sur_mesure"
  | "commerce_general"
  | "produit_numerique"
  | "general";

/** Libellés français lisibles pour chaque type de commerce. */
export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  couture_sur_mesure: "Couture sur-mesure",
  commerce_general: "Commerce général",
  produit_numerique: "Produit numérique",
  general: "Général / non précisé",
};

export const BUSINESS_TYPES: BusinessType[] = [
  "couture_sur_mesure",
  "commerce_general",
  "produit_numerique",
  "general",
];

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  contact_email?: string;
  api_key_public: string;
  plan: string;
  business_type: BusinessType;
  storage_limit_bytes: number;
  storage_used_bytes: number;
  email_quota_per_day: number;
  rate_limit_per_sec: number;
  rate_limit_burst: number;
  is_active: boolean;
  // Profil public — logo, contact, identité de marque affichée sur le
  // site/dashboard du tenant. Tous optionnels.
  contact_name?: string;
  contact_phone?: string;
  contact_role?: string;
  logo_url?: string;
  brand_color?: string;
  tagline?: string;
  language: string;
}

export interface TenantSocial {
  id: string;
  type: string;
  url: string;
  position: number;
}

export interface UpdateTenantProfileInput {
  contact_email?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_role?: string;
  logo_url?: string;
  brand_color?: string;
  tagline?: string;
  language?: string;
}

/** Les six services optionnels, chacun activable indépendamment par tenant. */
export interface FeatureFlags {
  products_enabled: boolean;
  fabrics_enabled: boolean;
  cart_enabled: boolean;
  gallery_enabled: boolean;
  reviews_enabled: boolean;
  staff_enabled: boolean;
}

export const FEATURE_LABELS: Record<keyof FeatureFlags, string> = {
  products_enabled: "Produits",
  fabrics_enabled: "Tissus",
  cart_enabled: "Panier",
  gallery_enabled: "Galerie",
  staff_enabled: "Équipe",
  reviews_enabled: "Avis",
};

export interface CreateTenantResponse {
  tenant: Tenant;
  api_key_secret: string;
}

/** Compte super-admin ABMCY (users.tenant_id IS NULL, role = 'super_admin'). */
export interface AdminAccount {
  id: string;
  email: string;
  is_active: boolean;
}

/** Réponse de POST /admin/tenants/{tenantID}/logo — même forme que le
 * retour de POST /uploads/image côté tenant-dashboard. */
export interface UploadedImage {
  id: string;
  url: string;
  size_bytes: number;
}

/** Clés de configuration plateforme gérées par /admin/config. */
export type ConfigKey =
  | "R2_ACCOUNT_ID"
  | "R2_ACCESS_KEY_ID"
  | "R2_SECRET_ACCESS_KEY"
  | "R2_BUCKET"
  | "R2_PUBLIC_URL"
  | "RESEND_API_KEY"
  | "RESEND_FROM_ADDR"
  | "CINETPAY_API_KEY"
  | "CINETPAY_SITE_ID"
  | "CORS_ORIGINS";

export interface ConfigStatus {
  key: ConfigKey;
  configured: boolean;
  /** Absent pour les clés secrètes, même lorsqu'elles sont configurées. */
  value?: string;
}

export interface TrafficSummary {
  tenant_id: string;
  tenant_slug: string;
  request_count: number;
  error_count: number;
  rate_limited_count: number;
}

export interface RoutePopularity {
  method: string;
  path: string;
  request_count: number;
}

export interface RecentRequest {
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  rate_limited: boolean;
  created_at: string;
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

/** Un JWT a toujours exactement deux points ; une clé X-Admin-Key statique jamais. */
function isJwt(credential: string): boolean {
  return (credential.match(/\./g) ?? []).length === 2;
}

async function request<T>(
  path: string,
  adminKey: string,
  init?: RequestInit
): Promise<T> {
  const authHeaders: Record<string, string> = isJwt(adminKey)
    ? { Authorization: `Bearer ${adminKey}` }
    : { "X-Admin-Key": adminKey };

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
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

/**
 * POST /admin/auth/login — échange email/mot de passe contre un JWT
 * admin. N'utilise pas request() : à ce stade on n'a encore aucune
 * credential à envoyer, c'est justement cet appel qui en produit une.
 */
export async function adminLogin(email: string, password: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      0,
      "Impossible de contacter le serveur. Vérifiez l'URL de l'API et votre connexion."
    );
  }

  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = await res.json();
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

/** GET /admin/tenants — liste tous les tenants. */
export function listTenants(adminKey: string): Promise<Tenant[]> {
  return request<Tenant[]>("/admin/tenants", adminKey, { method: "GET" });
}

/** POST /admin/tenants — crée un nouveau tenant. */
export function createTenant(
  adminKey: string,
  input: {
    name: string;
    slug: string;
    contact_email?: string;
    business_type?: BusinessType;
  }
): Promise<CreateTenantResponse> {
  return request<CreateTenantResponse>("/admin/tenants", adminKey, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * POST /admin/tenants/{tenantID}/api-keys — régénère la paire de clés API
 * d'un tenant. L'ancienne clé publique cesse immédiatement de fonctionner.
 * Le nouveau secret n'est renvoyé qu'une seule fois.
 */
export function regenerateTenantApiKeys(
  adminKey: string,
  tenantId: string
): Promise<CreateTenantResponse> {
  return request<CreateTenantResponse>(
    `/admin/tenants/${encodeURIComponent(tenantId)}/api-keys`,
    adminKey,
    { method: "POST" }
  );
}

/**
 * DELETE /admin/tenants/{tenantID} — supprime définitivement un tenant et
 * toutes ses données (commandes, produits, clients, comptes, logs...).
 * Irréversible.
 */
export function deleteTenant(adminKey: string, tenantId: string): Promise<void> {
  return request<void>(`/admin/tenants/${encodeURIComponent(tenantId)}`, adminKey, {
    method: "DELETE",
  });
}

/** PUT /admin/tenants/{tenantID}/rate-limit — met à jour les limites de trafic d'un tenant. */
export function updateTenantRateLimit(
  adminKey: string,
  tenantId: string,
  input: { rate_limit_per_sec: number; rate_limit_burst: number }
): Promise<void> {
  return request<void>(
    `/admin/tenants/${encodeURIComponent(tenantId)}/rate-limit`,
    adminKey,
    {
      method: "PUT",
      body: JSON.stringify(input),
    }
  );
}

/** PUT /admin/tenants/{tenantID}/active — suspend ou réactive un tenant. */
export function updateTenantActive(
  adminKey: string,
  tenantId: string,
  isActive: boolean
): Promise<void> {
  return request<void>(
    `/admin/tenants/${encodeURIComponent(tenantId)}/active`,
    adminKey,
    {
      method: "PUT",
      body: JSON.stringify({ is_active: isActive }),
    }
  );
}

/**
 * POST /admin/tenants/{tenantID}/logo — upload un fichier logo pour un
 * tenant depuis le dashboard admin (sans avoir besoin de la clé API de ce
 * tenant). Ne modifie pas le profil : la réponse renvoie juste l'URL, à
 * enregistrer ensuite via updateTenantProfile({ logo_url }).
 */
export function uploadTenantLogo(
  adminKey: string,
  tenantId: string,
  file: File
): Promise<UploadedImage> {
  const form = new FormData();
  form.append("image", file);
  // request() ne peut pas être réutilisé tel quel : il force
  // Content-Type: application/json, ce qui casserait un multipart/form-data
  // (le navigateur doit fixer sa propre boundary). On duplique donc la
  // logique d'auth + gestion d'erreur ici, plutôt que de complexifier
  // request() pour ce seul appel.
  const authHeaders: Record<string, string> = isJwt(adminKey)
    ? { Authorization: `Bearer ${adminKey}` }
    : { "X-Admin-Key": adminKey };

  return fetch(`${API_URL}/admin/tenants/${encodeURIComponent(tenantId)}/logo`, {
    method: "POST",
    headers: authHeaders,
    body: form,
    cache: "no-store",
  })
    .catch(() => {
      throw new ApiError(
        0,
        "Impossible de contacter le serveur. Vérifiez l'URL de l'API et votre connexion."
      );
    })
    .then(async (res) => {
      if (res.status === 403 || res.status === 401) {
        throw new ApiError(res.status, "Clé admin invalide ou accès refusé.", "forbidden");
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
      return (await res.json()) as UploadedImage;
    });
}

/** GET /admin/accounts — liste les comptes super-admin ABMCY. */
export function listAdminAccounts(adminKey: string): Promise<AdminAccount[]> {
  return request<AdminAccount[]>("/admin/accounts", adminKey, { method: "GET" });
}

/** POST /admin/accounts — crée un nouveau compte super-admin ABMCY. */
export function createAdminAccount(
  adminKey: string,
  email: string,
  password: string
): Promise<AdminAccount> {
  return request<AdminAccount>("/admin/accounts", adminKey, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

/** PUT /admin/accounts/{userID}/active — active ou désactive un compte super-admin. */
export function setAdminAccountActive(
  adminKey: string,
  userId: string,
  isActive: boolean
): Promise<void> {
  return request<void>(`/admin/accounts/${encodeURIComponent(userId)}/active`, adminKey, {
    method: "PUT",
    body: JSON.stringify({ is_active: isActive }),
  });
}

/** GET /admin/tenants/{tenantID}/payment-config — indique si les clés
 * ABMCY Core Payment du tenant sont renseignées (jamais les valeurs). */
export function getTenantPaymentConfig(
  adminKey: string,
  tenantId: string
): Promise<{ configured: boolean }> {
  return request<{ configured: boolean }>(
    `/admin/tenants/${encodeURIComponent(tenantId)}/payment-config`,
    adminKey,
    { method: "GET" }
  );
}

/** PUT /admin/tenants/{tenantID}/payment-config — enregistre (ou remplace)
 * les clés ABMCY Core Payment du tenant. */
export function setTenantPaymentConfig(
  adminKey: string,
  tenantId: string,
  input: { app_key: string; hmac_secret: string }
): Promise<void> {
  return request<void>(
    `/admin/tenants/${encodeURIComponent(tenantId)}/payment-config`,
    adminKey,
    { method: "PUT", body: JSON.stringify(input) }
  );
}

/** DELETE /admin/tenants/{tenantID}/payment-config — retire les clés de
 * paiement du tenant (ses paiements repassent en 503). */
export function deleteTenantPaymentConfig(
  adminKey: string,
  tenantId: string
): Promise<void> {
  return request<void>(
    `/admin/tenants/${encodeURIComponent(tenantId)}/payment-config`,
    adminKey,
    { method: "DELETE" }
  );
}

/** PUT /admin/tenants/{tenantID}/business-type — modifie le type de commerce d'un tenant. */
export function updateTenantBusinessType(
  adminKey: string,
  tenantId: string,
  businessType: BusinessType
): Promise<void> {
  return request<void>(
    `/admin/tenants/${encodeURIComponent(tenantId)}/business-type`,
    adminKey,
    {
      method: "PUT",
      body: JSON.stringify({ business_type: businessType }),
    }
  );
}

/** PUT /admin/tenants/{tenantID}/profile — modifie le profil public d'un tenant (logo, contact, marque). */
export function updateTenantProfile(
  adminKey: string,
  tenantId: string,
  input: UpdateTenantProfileInput
): Promise<Tenant> {
  return request<Tenant>(
    `/admin/tenants/${encodeURIComponent(tenantId)}/profile`,
    adminKey,
    {
      method: "PUT",
      body: JSON.stringify(input),
    }
  );
}

/** GET /admin/tenants/{tenantID}/socials — liste les liens sociaux d'un tenant. */
export function listTenantSocials(
  adminKey: string,
  tenantId: string
): Promise<TenantSocial[]> {
  return request<TenantSocial[]>(
    `/admin/tenants/${encodeURIComponent(tenantId)}/socials`,
    adminKey,
    { method: "GET" }
  );
}

/** PUT /admin/tenants/{tenantID}/socials — remplace la liste complète des liens sociaux d'un tenant. */
export function setTenantSocials(
  adminKey: string,
  tenantId: string,
  socials: { type: string; url: string }[]
): Promise<TenantSocial[]> {
  return request<TenantSocial[]>(
    `/admin/tenants/${encodeURIComponent(tenantId)}/socials`,
    adminKey,
    {
      method: "PUT",
      body: JSON.stringify({ socials }),
    }
  );
}

/** GET /admin/tenants/{tenantID}/features — lit les fonctionnalités optionnelles d'un tenant. */
export function getTenantFeatures(
  adminKey: string,
  tenantId: string
): Promise<FeatureFlags> {
  return request<FeatureFlags>(
    `/admin/tenants/${encodeURIComponent(tenantId)}/features`,
    adminKey,
    { method: "GET" }
  );
}

/** PUT /admin/tenants/{tenantID}/features — active ou désactive le catalogue pour un tenant. */
export function updateTenantFeatures(
  adminKey: string,
  tenantId: string,
  input: FeatureFlags
): Promise<void> {
  return request<void>(
    `/admin/tenants/${encodeURIComponent(tenantId)}/features`,
    adminKey,
    {
      method: "PUT",
      body: JSON.stringify(input),
    }
  );
}

/** GET /admin/config — statut de chaque clé de configuration plateforme. */
export function getConfigStatus(adminKey: string): Promise<ConfigStatus[]> {
  return request<ConfigStatus[]>("/admin/config", adminKey, { method: "GET" });
}

/** PUT /admin/config/{key} — définit ou modifie une clé de configuration. */
export function setConfigValue(
  adminKey: string,
  key: ConfigKey,
  value: string
): Promise<void> {
  return request<void>(`/admin/config/${encodeURIComponent(key)}`, adminKey, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
}

/** GET /admin/traffic — résumé du trafic des dernières 24h, par tenant. */
export function getTrafficSummary(adminKey: string): Promise<TrafficSummary[]> {
  return request<TrafficSummary[]>("/admin/traffic", adminKey, {
    method: "GET",
  });
}

/** GET /admin/traffic/{tenantID} — les 100 dernières requêtes d'un tenant. */
export function getTenantTraffic(
  adminKey: string,
  tenantId: string
): Promise<RecentRequest[]> {
  return request<RecentRequest[]>(
    `/admin/traffic/${encodeURIComponent(tenantId)}`,
    adminKey,
    { method: "GET" }
  );
}

/** GET /admin/traffic/top-routes — routes les plus sollicitées, tous tenants confondus. */
export function getTrafficTopRoutes(
  adminKey: string
): Promise<RoutePopularity[]> {
  return request<RoutePopularity[]>("/admin/traffic/top-routes", adminKey, {
    method: "GET",
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
