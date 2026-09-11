// Client serveur uniquement — la clé API (STOREFRONT_API_KEY) ne doit
// jamais atteindre le navigateur. Chaque fonction ici est appelée depuis
// un composant serveur ou une Route Handler, jamais depuis "use client".
// import "server-only" fait échouer le build si un fichier client
// l'importe par erreur.
import "server-only";

const API_BASE = process.env.ABMCY_API_BASE ?? "https://api.abmcy.com";
const API_KEY = process.env.STOREFRONT_API_KEY ?? "";
export const TENANT_SLUG = "nathan";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "X-API-Key": API_KEY,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Impossible de contacter le serveur. Réessayez.");
  }

  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    let message = "Une erreur est survenue.";
    let code: string | undefined;
    try {
      const body = await res.json();
      message = body?.error?.message ?? message;
      code = body?.error?.code;
    } catch {
      // pas de corps JSON exploitable
    }
    throw new ApiError(res.status, message, code);
  }

  return (await res.json()) as T;
}

// --- Types ------------------------------------------------------------

export interface ProductImage {
  id: string;
  url: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  sku?: string;
  stock_quantity: number | null;
  attributes?: Record<string, unknown>;
  is_featured: boolean;
  is_active: boolean;
  images?: ProductImage[];
}

export interface OrderItem {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "paid"
  | "in_progress"
  | "shipped"
  | "delivered"
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
  items?: OrderItem[];
  created_at: string;
}

export interface DeliveryLink {
  filename: string;
  url: string;
  expires_at: string;
}

// --- Produits -----------------------------------------------------------

export function listProducts(params?: {
  category?: string;
  sort?: "price_asc" | "price_desc" | "newest" | "featured";
}): Promise<Product[]> {
  const q = new URLSearchParams();
  if (params?.category) q.set("category", params.category);
  if (params?.sort) q.set("sort", params.sort);
  const qs = q.toString();
  return apiRequest<Product[]>(`/products${qs ? `?${qs}` : ""}`);
}

export function getProduct(productId: string): Promise<Product> {
  return apiRequest<Product>(`/products/${encodeURIComponent(productId)}`);
}

// --- Commandes ------------------------------------------------------------

export interface CreateOrderInput {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  items: { product_id: string; quantity: number }[];
}

export function createOrder(input: CreateOrderInput): Promise<Order> {
  return apiRequest<Order>("/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getOrder(orderId: string): Promise<Order> {
  return apiRequest<Order>(`/orders/${encodeURIComponent(orderId)}`);
}

// --- Paiement -------------------------------------------------------------

export function initPayment(
  orderId: string,
  returnUrl: string
): Promise<{ payment_url: string }> {
  return apiRequest<{ payment_url: string }>("/payments/init", {
    method: "POST",
    body: JSON.stringify({ order_id: orderId, return_url: returnUrl }),
  });
}

// --- Livraison --------------------------------------------------------

export function getOrderDelivery(
  orderId: string
): Promise<{ files: DeliveryLink[] }> {
  return apiRequest<{ files: DeliveryLink[] }>(
    `/orders/${encodeURIComponent(orderId)}/delivery`
  );
}
