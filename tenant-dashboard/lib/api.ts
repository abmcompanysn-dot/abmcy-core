// Client centralisant tous les appels vers le backend ABMCY Core.
// Toutes les requêtes tenant injectent le header X-API-Key, lu depuis
// le localStorage du navigateur (jamais stocké en dur dans le code).

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  "https://api.abmcy.com";

/** Documentation d'intégration API — page du site vitrine, pas un artifact. */
export const DOCS_URL = "https://core.abmcy.com/docs";

const API_KEY_STORAGE_KEY = "abmcy_tenant_api_key";

/** Lit la clé API stockée localement (uniquement côté navigateur). */
export function getStoredApiKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(API_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Sauvegarde la clé API dans le localStorage du navigateur. */
export function storeApiKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(API_KEY_STORAGE_KEY, key);
  } catch {
    // localStorage indisponible (mode privé strict, etc.) — on ignore.
  }
}

/** Supprime la clé API stockée localement (déconnexion). */
export function clearStoredApiKey(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// --- Types ----------------------------------------------------------

export type OrderStatus =
  | "pending"
  | "paid"
  | "in_progress"
  | "shipped"
  | "cancelled"
  | string;

export interface Order {
  id: string;
  order_number: string;
  customer_id?: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  shipping_address?: string;
  total_amount: number;
  status: OrderStatus;
  measurements?: Record<string, unknown> | null;
  measurements_id?: string;
  fabric_id?: string;
  fabric_source?: FabricSource;
  notes?: string;
  created_at: string;
}

export interface CreateOrderInput {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  total_amount: number;
  measurements?: Record<string, unknown>;
}

/** Champs qu'un tenant peut encore modifier avant validation (pending/confirmed). */
export interface UpdateOrderInput {
  shipping_address?: string;
  measurements?: Record<string, unknown>;
  notes?: string;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  comment?: string;
  created_at: string;
}

/** maison = tissu du catalogue, envoi_photo = le client envoie sa propre photo,
 * conseil_atelier = le client laisse le choix à l'atelier. */
export type FabricSource = "maison" | "envoi_photo" | "conseil_atelier" | string;

export interface CreateCustomOrderInput {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  shipping_address?: string;
  total_amount: number;
  measurements?: Record<string, unknown>;
  fabric_id?: string;
  fabric_source?: FabricSource;
  notes?: string;
}

export type Gender = "femme" | "homme";

export interface SaveMeasurementsInput {
  customer_name: string;
  customer_phone: string;
  gender: Gender;
  values: Record<string, unknown>;
}

export interface Measurement {
  id: string;
  gender: Gender;
  values: Record<string, unknown>;
}

// --- Fonctionnalités (feature flags) ---------------------------------

export interface Features {
  catalog_enabled: boolean;
}

// --- Catalogue (optionnel, activé par tenant) ------------------------

export interface ProductImage {
  id: string;
  url: string;
}

/** Le champ attributes est un JSON libre : {"gender":"femme","sizes":["S","M"]}
 * pour la couture, {"brand":"...","weight_kg":1.5} pour un commerce général,
 * {"download_url":"...","license":"perso"} pour un produit numérique, etc. */
export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  sku?: string;
  stock_quantity?: number | null;
  attributes?: Record<string, unknown> | null;
  is_featured: boolean;
  is_active: boolean;
  images?: ProductImage[];
}

export interface CreateProductInput {
  name: string;
  description?: string;
  price: number;
  category?: string;
  sku?: string;
  stock_quantity?: number | null;
  attributes?: Record<string, unknown>;
  is_featured?: boolean;
}

export interface ProductListFilter {
  category?: string;
  sort?: "price_asc" | "price_desc" | "newest" | "featured";
}

export interface Fabric {
  id: string;
  name: string;
  description?: string;
  extra_price: number;
  image_url?: string;
  is_active: boolean;
}

export interface CreateFabricInput {
  name: string;
  description?: string;
  extra_price: number;
  image_url?: string;
}

export type GalleryCategory = "femme" | "homme" | "sur_mesure" | "artisanat";

export interface GalleryPhoto {
  id: string;
  image_url: string;
  category?: GalleryCategory | string;
  caption?: string;
}

export interface AddGalleryPhotoInput {
  image_url: string;
  category?: GalleryCategory | string;
  caption?: string;
}

export interface CartItem {
  id: string;
  product_id: string;
  fabric_id?: string;
  size?: string;
  color?: string;
  quantity: number;
}

export interface AddCartItemInput {
  cart_token?: string;
  product_id: string;
  fabric_id?: string;
  size?: string;
  color?: string;
  quantity: number;
}

export interface AddCartItemResult {
  cart_token: string;
  item: CartItem;
}

export interface Review {
  id: string;
  order_id?: string;
  customer_id?: string;
  rating: number;
  comment?: string;
  photo_urls?: string[] | null;
  is_published: boolean;
}

export interface CreateReviewInput {
  order_id?: string;
  customer_id?: string;
  rating: number;
  comment?: string;
  photo_urls?: string[];
}

export interface UploadedImage {
  id: string;
  url: string;
  size_bytes: number;
}

export interface PaymentInitInput {
  order_id: string;
  amount: number;
  customer_name: string;
  customer_phone: string;
  return_url: string;
}

export interface PaymentInitResult {
  payment_url: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  template?: string;
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

/** Un JWT a toujours exactement deux points ; une clé X-API-Key statique jamais. */
function isJwt(credential: string): boolean {
  return (credential.match(/\./g) ?? []).length === 2;
}

async function request<T>(
  path: string,
  apiKey: string,
  init?: RequestInit
): Promise<T> {
  const authHeaders: Record<string, string> = isJwt(apiKey)
    ? { Authorization: `Bearer ${apiKey}` }
    : { "X-API-Key": apiKey };

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
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
    let body: ApiErrorBody | null = null;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      // corps non-JSON ou vide
    }
    throw new ApiError(
      res.status,
      body?.error?.message || "Clé API invalide ou accès refusé.",
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

/**
 * POST /auth/login — échange identifiant boutique + email/mot de passe
 * contre un JWT personnel. N'utilise pas request() : à ce stade on n'a
 * encore aucune credential à envoyer, c'est cet appel qui en produit une.
 */
export async function staffLogin(
  tenantSlug: string,
  email: string,
  password: string
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_slug: tenantSlug, email, password }),
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
      body?.error?.message || "Identifiant boutique, email ou mot de passe incorrect.",
      body?.error?.code
    );
  }

  const { token } = (await res.json()) as { token: string };
  return token;
}

/** GET /orders — liste les commandes du tenant connecté. */
export function listOrders(apiKey: string): Promise<Order[]> {
  return request<Order[]>("/orders", apiKey, { method: "GET" });
}

/** POST /orders — crée une nouvelle commande. */
export function createOrder(
  apiKey: string,
  input: CreateOrderInput
): Promise<Order> {
  return request<Order>("/orders", apiKey, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** GET /orders/{id} — détail d'une commande. */
export function getOrder(apiKey: string, orderId: string): Promise<Order> {
  return request<Order>(`/orders/${orderId}`, apiKey, { method: "GET" });
}

/** PATCH /orders/{id} — modifie adresse/mesures/notes tant que la
 * commande est encore éditable (pending/confirmed). */
export function updateOrder(
  apiKey: string,
  orderId: string,
  input: UpdateOrderInput
): Promise<Order> {
  return request<Order>(`/orders/${orderId}`, apiKey, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** GET /orders/{id}/history — historique des statuts d'une commande. */
export function getOrderHistory(
  apiKey: string,
  orderId: string
): Promise<OrderStatusEvent[]> {
  return request<OrderStatusEvent[]>(`/orders/${orderId}/history`, apiKey, {
    method: "GET",
  });
}

/** POST /custom-orders — commande sur-mesure (tissu, mesures, adresse...). */
export function createCustomOrder(
  apiKey: string,
  input: CreateCustomOrderInput
): Promise<Order> {
  return request<Order>("/custom-orders", apiKey, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** POST /measurements — enregistre un jeu de mesures pour un client. */
export function saveMeasurements(
  apiKey: string,
  input: SaveMeasurementsInput
): Promise<Measurement> {
  return request<Measurement>("/measurements", apiKey, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// --- Fonctionnalités --------------------------------------------------

/** GET /features — indique si le catalogue est activé pour ce tenant. */
export function getFeatures(apiKey: string): Promise<Features> {
  return request<Features>("/features", apiKey, { method: "GET" });
}

/** POST /uploads/image — envoie une image (multipart/form-data). */
export function uploadImage(
  apiKey: string,
  file: File
): Promise<UploadedImage> {
  const form = new FormData();
  form.append("image", file);
  return request<UploadedImage>("/uploads/image", apiKey, {
    method: "POST",
    body: form,
  });
}

/** POST /payments/init — initie un paiement CinetPay pour une commande. */
export function initPayment(
  apiKey: string,
  input: PaymentInitInput
): Promise<PaymentInitResult> {
  return request<PaymentInitResult>("/payments/init", apiKey, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** POST /notifications/email — envoie un email au client. */
export function sendEmail(
  apiKey: string,
  input: SendEmailInput
): Promise<void> {
  return request<void>("/notifications/email", apiKey, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// --- Catalogue (produits) ---------------------------------------------

/** GET /products — liste les produits du tenant (si catalogue activé). */
export function listProducts(
  apiKey: string,
  filter?: ProductListFilter
): Promise<Product[]> {
  const params = new URLSearchParams();
  if (filter?.category) params.set("category", filter.category);
  if (filter?.sort) params.set("sort", filter.sort);
  const qs = params.toString();
  return request<Product[]>(`/products${qs ? `?${qs}` : ""}`, apiKey, {
    method: "GET",
  });
}

/** POST /products — crée un produit. */
export function createProduct(
  apiKey: string,
  input: CreateProductInput
): Promise<Product> {
  return request<Product>("/products", apiKey, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** GET /products/{id} — détail d'un produit (avec ses images). */
export function getProduct(apiKey: string, productId: string): Promise<Product> {
  return request<Product>(`/products/${productId}`, apiKey, { method: "GET" });
}

// --- Catalogue (tissus) -------------------------------------------------

/** GET /fabrics — liste les tissus du tenant. */
export function listFabrics(apiKey: string): Promise<Fabric[]> {
  return request<Fabric[]>("/fabrics", apiKey, { method: "GET" });
}

/** POST /fabrics — crée un tissu. */
export function createFabric(
  apiKey: string,
  input: CreateFabricInput
): Promise<Fabric> {
  return request<Fabric>("/fabrics", apiKey, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** POST /fabrics/upload — envoie la photo d'un tissu (multipart), renvoie son URL. */
export function uploadFabricPhoto(
  apiKey: string,
  file: File
): Promise<{ url: string }> {
  const form = new FormData();
  form.append("image", file);
  return request<{ url: string }>("/fabrics/upload", apiKey, {
    method: "POST",
    body: form,
  });
}

// --- Catalogue (galerie de réalisations) --------------------------------

/** GET /gallery — liste les photos de réalisations, filtrable par catégorie. */
export function listGalleryPhotos(
  apiKey: string,
  category?: string
): Promise<GalleryPhoto[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  return request<GalleryPhoto[]>(`/gallery${qs}`, apiKey, { method: "GET" });
}

/** POST /gallery — ajoute une photo de réalisation à la galerie. */
export function addGalleryPhoto(
  apiKey: string,
  input: AddGalleryPhotoInput
): Promise<GalleryPhoto> {
  return request<GalleryPhoto>("/gallery", apiKey, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// --- Catalogue (panier) --------------------------------------------------

/** GET /cart?cart_token=... — contenu du panier associé à ce jeton. */
export function getCart(apiKey: string, cartToken: string): Promise<CartItem[]> {
  return request<CartItem[]>(
    `/cart?cart_token=${encodeURIComponent(cartToken)}`,
    apiKey,
    { method: "GET" }
  );
}

/** POST /cart — ajoute un article au panier (crée un jeton si absent). */
export function addCartItem(
  apiKey: string,
  input: AddCartItemInput
): Promise<AddCartItemResult> {
  return request<AddCartItemResult>("/cart", apiKey, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** DELETE /cart/{itemID}?cart_token=... — retire un article du panier. */
export function removeCartItem(
  apiKey: string,
  itemId: string,
  cartToken: string
): Promise<void> {
  return request<void>(
    `/cart/${itemId}?cart_token=${encodeURIComponent(cartToken)}`,
    apiKey,
    { method: "DELETE" }
  );
}

// --- Catalogue (avis clients) --------------------------------------------

/** POST /reviews — enregistre un avis (non publié tant qu'il n'est pas modéré). */
export function createReview(
  apiKey: string,
  input: CreateReviewInput
): Promise<Review> {
  return request<Review>("/reviews", apiKey, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** GET /reviews — liste les avis déjà publiés. */
export function listPublishedReviews(apiKey: string): Promise<Review[]> {
  return request<Review[]>("/reviews", apiKey, { method: "GET" });
}

/** GET /reviews/pending — liste les avis en attente de modération. */
export function listPendingReviews(apiKey: string): Promise<Review[]> {
  return request<Review[]>("/reviews/pending", apiKey, { method: "GET" });
}

/** POST /reviews/{id}/publish — publie un avis en attente. */
export function publishReview(apiKey: string, reviewId: string): Promise<void> {
  return request<void>(`/reviews/${reviewId}/publish`, apiKey, {
    method: "POST",
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
