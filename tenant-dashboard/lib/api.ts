// Client centralisant tous les appels vers le backend ABMCY Core.
// Toutes les requêtes tenant injectent le header X-API-Key, lu depuis
// le localStorage du navigateur (jamais stocké en dur dans le code).

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  "https://api.abmcy.com";

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
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  total_amount: number;
  status: OrderStatus;
  measurements?: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateOrderInput {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  total_amount: number;
  measurements?: Record<string, unknown>;
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

async function request<T>(
  path: string,
  apiKey: string,
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
        "X-API-Key": apiKey,
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

/** GET /health — simple vérification de disponibilité de l'API. */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
