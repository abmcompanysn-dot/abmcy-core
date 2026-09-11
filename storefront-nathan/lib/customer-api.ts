"use client";

// Ces appels partent DIRECTEMENT du navigateur vers l'API ABMCY — le JWT
// client (Authorization: Bearer) n'est pas un secret d'intégration, il
// identifie juste l'acheteur connecté (contrairement à X-API-Key, voir
// lib/api.ts qui reste server-only).
const API_BASE =
  process.env.NEXT_PUBLIC_ABMCY_API_BASE ?? "https://api.abmcy.com";
const TENANT_SLUG = "nathan";
const TOKEN_KEY = "nathan_customer_token";

export class CustomerApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // localStorage indisponible — la session ne persiste juste pas.
  }
}

export function clearToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch {
    throw new CustomerApiError(0, "Impossible de contacter le serveur.");
  }

  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    let message = "Une erreur est survenue.";
    try {
      const body = await res.json();
      message = body?.error?.message ?? message;
    } catch {
      // pas de corps exploitable
    }
    throw new CustomerApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export function login(phone: string, password: string): Promise<{ token: string }> {
  return request<{ token: string }>("/auth/customer/login", {
    method: "POST",
    body: JSON.stringify({ tenant_slug: TENANT_SLUG, phone, password }),
  });
}

export function register(
  phone: string,
  email: string,
  password: string
): Promise<{ token: string }> {
  return request<{ token: string }>("/auth/customer/register", {
    method: "POST",
    body: JSON.stringify({ tenant_slug: TENANT_SLUG, phone, email, password }),
  });
}

export interface CustomerOrder {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  created_at: string;
}

export function listMyOrders(): Promise<CustomerOrder[]> {
  return request<CustomerOrder[]>("/auth/customer/orders");
}

export function getMyOrderDelivery(
  orderId: string
): Promise<{ files: { filename: string; url: string }[] }> {
  return request(`/auth/customer/orders/${encodeURIComponent(orderId)}/delivery`);
}
