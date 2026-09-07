import type { Product } from "@/lib/api";
import { formatFCFA } from "@/lib/format";

export function ProductsTable({ products }: { products: Product[] }) {
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
            <th className="px-4 py-3 font-medium">Nom</th>
            <th className="px-4 py-3 font-medium">Catégorie</th>
            <th className="px-4 py-3 font-medium">SKU</th>
            <th className="px-4 py-3 font-medium">Prix</th>
            <th className="px-4 py-3 font-medium">Stock</th>
            <th className="px-4 py-3 font-medium">Attributs</th>
            <th className="px-4 py-3 font-medium">Mise en avant</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr
              key={product.id}
              className="border-b border-slate-100 last:border-0 hover:bg-slate-50 align-top"
            >
              <td className="px-4 py-3 text-slate-900">
                <div className="font-medium">{product.name}</div>
                {product.description && (
                  <div className="mt-0.5 max-w-xs text-xs text-slate-500">
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
                {product.attributes &&
                Object.keys(product.attributes).length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(product.attributes).map(([key, value]) => (
                      <span
                        key={key}
                        className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                      >
                        {key}:{" "}
                        {Array.isArray(value) ? value.join(", ") : String(value)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
