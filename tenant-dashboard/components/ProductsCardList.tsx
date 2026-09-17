"use client";

import { useState } from "react";
import type { Product } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { EditProductForm } from "./EditProductForm";

function thumbnailFor(product: Product): string | null {
  if (product.images && product.images.length > 0) {
    return product.images[0].url;
  }
  const fromAttrs = product.attributes?.image_url;
  return typeof fromAttrs === "string" ? fromAttrs : null;
}

/** Version mobile de ProductsTable : une carte par produit. */
export function ProductsCardList({
  products,
  onUpdated,
}: {
  products: Product[];
  onUpdated?: (product: Product) => void;
}) {
  const [editing, setEditing] = useState<Product | null>(null);

  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Aucun produit pour le moment. Créez votre premier produit avec le
        bouton ci-dessus.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {products.map((product) => {
        const thumbnail = thumbnailFor(product);
        return (
          <button
            key={product.id}
            onClick={() => setEditing(product)}
            className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm"
          >
            <div className="aspect-square w-full bg-slate-100">
              {thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnail}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                  Aucune photo
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-3">
              <p className="line-clamp-2 text-sm font-medium text-slate-900">
                {product.name}
              </p>
              {product.category && (
                <p className="text-xs text-slate-500">{product.category}</p>
              )}
              <div className="mt-auto flex items-center justify-between pt-1">
                <span className="text-sm font-semibold text-slate-900">
                  {formatFCFA(product.price)}
                </span>
                {!product.is_active && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    Inactif
                  </span>
                )}
                {product.is_featured && (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    En avant
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}

      {editing && (
        <EditProductForm
          product={editing}
          onClose={() => setEditing(null)}
          onUpdated={(updated) => {
            onUpdated?.(updated);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
