"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addToCart } from "@/lib/cart";

export function AddToCartButton({
  productId,
  name,
  price,
}: {
  productId: string;
  name: string;
  price: number;
}) {
  const router = useRouter();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    addToCart({ productId, name, price });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  function handleBuyNow() {
    addToCart({ productId, name, price });
    router.push("/panier");
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        onClick={handleBuyNow}
        className="flex-1 rounded-full bg-accent px-7 py-3.5 text-center text-sm font-semibold text-bg shadow-lg shadow-accent/20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
      >
        Acheter maintenant
      </button>
      <button
        onClick={handleAdd}
        className="flex-1 rounded-full border border-white/10 px-7 py-3.5 text-center text-sm font-semibold text-text transition-colors hover:border-accent/40"
      >
        {added ? "Ajouté au panier" : "Ajouter au panier"}
      </button>
    </div>
  );
}
