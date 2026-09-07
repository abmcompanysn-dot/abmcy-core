"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError, listProducts, type Product } from "@/lib/api";
import { CatalogGate } from "@/components/CatalogGate";
import { NewProductForm } from "@/components/NewProductForm";
import { ProductsTable } from "@/components/ProductsTable";

function CataloguePageContent() {
  const { apiKey } = useAuth();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [settledToken, setSettledToken] = useState(-1);
  const loading = settledToken !== reloadToken;

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    listProducts(apiKey)
      .then((data) => {
        if (cancelled) return;
        setProducts(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger la liste des produits."
        );
      })
      .finally(() => {
        if (!cancelled) setSettledToken(reloadToken);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, reloadToken]);

  function reload() {
    setReloadToken((t) => t + 1);
  }

  function handleCreated(product: Product) {
    setProducts((prev) => (prev ? [product, ...prev] : [product]));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Catalogue</h1>
          <p className="text-sm text-slate-500">
            Gérez les produits de votre boutique.
          </p>
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
        >
          {loading ? "Actualisation..." : "Actualiser"}
        </button>
      </div>

      <NewProductForm onCreated={handleCreated} />

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && products === null ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Chargement des produits...
        </div>
      ) : (
        <ProductsTable products={products ?? []} />
      )}
    </div>
  );
}

export default function CataloguePage() {
  return (
    <CatalogGate>
      <CataloguePageContent />
    </CatalogGate>
  );
}
