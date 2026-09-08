"use client";

import { useState } from "react";
import type { Product } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { EditProductForm } from "./EditProductForm";

// L'image d'un produit peut venir soit de product_images (upload lié au
// produit dès sa création), soit — cas des imports en masse comme le
// catalogue HANI'S, où l'image existait déjà avant même que le produit
// soit créé — d'attributes.image_url. On affiche la première trouvée.
function thumbnailFor(product: Product): string | null {
  if (product.images && product.images.length > 0) {
    return product.images[0].url;
  }
  const fromAttrs = product.attributes?.image_url;
  return typeof fromAttrs === "string" ? fromAttrs : null;
}

// attributes est un JSON libre : une valeur peut être une simple chaîne,
// un tableau de chaînes (tailles), ou un tableau d'objets (colors:
// [{name, hex}]) — .join() sur ce dernier cas produit "[object Object]",
// donc chaque élément est formaté individuellement plutôt que joint tel
// quel.
function formatAttributeValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(formatAttributeValue).join(", ");
  }
  if (value && typeof value === "object") {
    // Cas fréquent : {name, hex} pour une couleur — affiche le nom si
    // présent, sinon une représentation lisible du reste.
    const obj = value as Record<string, unknown>;
    if (typeof obj.name === "string") return obj.name;
    return Object.values(obj)
      .filter((v) => typeof v === "string" || typeof v === "number")
      .join(" ");
  }
  return String(value);
}

export function ProductsTable({
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
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3 font-medium">Photo</th>
            <th className="px-4 py-3 font-medium">Nom</th>
            <th className="px-4 py-3 font-medium">Catégorie</th>
            <th className="px-4 py-3 font-medium">SKU</th>
            <th className="px-4 py-3 font-medium">Prix</th>
            <th className="px-4 py-3 font-medium">Stock</th>
            <th className="px-4 py-3 font-medium">Attributs</th>
            <th className="px-4 py-3 font-medium">Mise en avant</th>
            <th className="px-4 py-3 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const thumbnail = thumbnailFor(product);
            return (
            <tr
              key={product.id}
              className="border-b border-slate-100 last:border-0 hover:bg-slate-50 align-top"
            >
              <td className="px-4 py-3">
                {thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbnail}
                    alt={product.name}
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100 text-[10px] text-slate-400">
                    Aucune
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-slate-900">
                <div className="max-w-xs font-medium">
                  {product.name}
                  {!product.is_active && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      Inactif
                    </span>
                  )}
                </div>
                {product.description && (
                  <div className="mt-0.5 line-clamp-2 max-w-xs text-xs text-slate-500">
                    {product.description}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {product.category || "—"}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-600">
                {product.sku || "—"}
              </td>
              <td className="px-4 py-3 font-medium text-slate-900">
                {formatFCFA(product.price)}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {product.stock_quantity ?? "Illimité"}
              </td>
              <td className="px-4 py-3">
                {(() => {
                  const entries = Object.entries(product.attributes ?? {}).filter(
                    ([key]) => key !== "image_url"
                  );
                  return entries.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {entries.map(([key, value]) => (
                        <span
                          key={key}
                          className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                        >
                          {key}: {formatAttributeValue(value)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  );
                })()}
              </td>
              <td className="px-4 py-3">
                {product.is_featured ? (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    En avant
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => setEditing(product)}
                  className="text-xs font-medium text-indigo-600 hover:underline"
                >
                  Modifier
                </button>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>

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
