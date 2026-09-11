"use client";

import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { cartCount, getCart } from "@/lib/cart";

export function CartBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(cartCount(getCart()));
    sync();
    window.addEventListener("cart-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("cart-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <Link
      href="/panier"
      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-text transition-colors hover:border-accent hover:text-accent"
      aria-label="Voir le panier"
    >
      <ShoppingBag className="h-4.5 w-4.5" strokeWidth={1.75} />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-bg">
          {count}
        </span>
      )}
    </Link>
  );
}
