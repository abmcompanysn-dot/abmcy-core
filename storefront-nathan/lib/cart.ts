"use client";

// Panier stocké côté navigateur (localStorage) — aucune API panier
// serveur : le vrai total n'est jamais celui affiché ici, il vient de
// POST /orders (voir lib/api.ts) une fois la commande créée.
const STORAGE_KEY = "nathan_cart";

export interface CartLine {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

function read(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

function write(lines: CartLine[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    window.dispatchEvent(new Event("cart-updated"));
  } catch {
    // localStorage indisponible (navigation privée, quota) — le panier
    // ne persiste juste pas dans ce cas.
  }
}

export function getCart(): CartLine[] {
  return read();
}

export function addToCart(line: Omit<CartLine, "quantity">, quantity = 1) {
  const lines = read();
  const existing = lines.find((l) => l.productId === line.productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    lines.push({ ...line, quantity });
  }
  write(lines);
}

export function updateQuantity(productId: string, quantity: number) {
  let lines = read();
  if (quantity <= 0) {
    lines = lines.filter((l) => l.productId !== productId);
  } else {
    const line = lines.find((l) => l.productId === productId);
    if (line) line.quantity = quantity;
  }
  write(lines);
}

export function removeFromCart(productId: string) {
  write(read().filter((l) => l.productId !== productId));
}

export function clearCart() {
  write([]);
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}
