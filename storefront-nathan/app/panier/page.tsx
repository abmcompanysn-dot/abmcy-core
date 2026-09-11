"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import {
  type CartLine,
  cartTotal,
  getCart,
  removeFromCart,
  updateQuantity,
} from "@/lib/cart";
import { formatFCFA } from "@/lib/format";

export default function CartPage() {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    const sync = () => setLines(getCart());
    sync();
    window.addEventListener("cart-updated", sync);
    return () => window.removeEventListener("cart-updated", sync);
  }, []);

  const total = cartTotal(lines);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      <h1 className="font-(family-name:--font-display) text-3xl font-bold text-text">
        Votre panier
      </h1>

      {lines.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-white/10 p-16 text-center">
          <p className="text-text-muted">Votre panier est vide.</p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-full bg-accent px-6 py-3 text-sm font-semibold text-bg"
          >
            Voir le catalogue
          </Link>
        </div>
      ) : (
        <div className="mt-10 space-y-4">
          {lines.map((line) => (
            <div
              key={line.productId}
              className="flex items-center gap-4 rounded-xl border border-white/5 bg-bg-secondary p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-text">
                  {line.name}
                </p>
                <p className="text-sm text-text-muted">
                  {formatFCFA(line.price)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    updateQuantity(line.productId, line.quantity - 1)
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-text transition-colors hover:border-accent"
                  aria-label="Diminuer la quantité"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-medium text-text">
                  {line.quantity}
                </span>
                <button
                  onClick={() =>
                    updateQuantity(line.productId, line.quantity + 1)
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-text transition-colors hover:border-accent"
                  aria-label="Augmenter la quantité"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <p className="w-24 text-right text-sm font-semibold text-text">
                {formatFCFA(line.price * line.quantity)}
              </p>

              <button
                onClick={() => removeFromCart(line.productId)}
                className="text-text-muted transition-colors hover:text-accent-secondary"
                aria-label="Retirer du panier"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between border-t border-white/10 pt-6">
            <span className="text-sm text-text-muted">
              Total indicatif
            </span>
            <span className="text-xl font-bold text-accent">
              {formatFCFA(total)}
            </span>
          </div>

          <Link
            href="/commande"
            className="block w-full rounded-full bg-accent px-7 py-3.5 text-center text-sm font-semibold text-bg shadow-lg shadow-accent/20 transition-transform hover:scale-[1.01]"
          >
            Passer la commande
          </Link>
        </div>
      )}
    </div>
  );
}
