"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError, createProduct, type Product } from "@/lib/api";
import {
  AttributesEditor,
  attributeFieldsToObject,
  type AttributeField,
} from "./AttributesEditor";

export function NewProductForm({
  onCreated,
}: {
  onCreated: (product: Product) => void;
}) {
  const { apiKey } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [sku, setSku] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [attributeFields, setAttributeFields] = useState<AttributeField[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setDescription("");
    setPrice("");
    setCategory("");
    setSku("");
    setStockQuantity("");
    setIsFeatured(false);
    setAttributeFields([]);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!apiKey) return;
    setError(null);

    if (!name.trim()) {
      setError("Le nom du produit est obligatoire.");
      return;
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setError("Le prix doit être un nombre supérieur à 0.");
      return;
    }
    let stockQuantityNum: number | undefined;
    if (stockQuantity.trim() !== "") {
      stockQuantityNum = Number(stockQuantity);
      if (!Number.isFinite(stockQuantityNum) || stockQuantityNum < 0) {
        setError("Le stock doit être un nombre positif (ou vide si illimité).");
        return;
      }
    }

    setLoading(true);
    try {
      const attributes = attributeFieldsToObject(attributeFields);
      const product = await createProduct(apiKey, {
        name: name.trim(),
        description: description.trim() || undefined,
        price: Math.round(priceNum),
        category: category.trim() || undefined,
        sku: sku.trim() || undefined,
        stock_quantity: stockQuantityNum,
        attributes:
          Object.keys(attributes).length > 0 ? attributes : undefined,
        is_featured: isFeatured,
      });
      onCreated(product);
      resetForm();
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible de créer le produit."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
      >
        + Nouveau produit
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          Nouveau produit
        </h2>
        <button
          onClick={() => {
            setOpen(false);
            resetForm();
          }}
          className="text-sm text-slate-400 hover:text-slate-600"
        >
          Annuler
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Nom *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Prix (FCFA) *
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Catégorie
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              SKU (référence)
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Stock (vide = illimité)
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input
              id="is-featured"
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              disabled={loading}
            />
            <label htmlFor="is-featured" className="text-sm text-slate-700">
              Mettre en avant ce produit
            </label>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            disabled={loading}
          />
        </div>

        <AttributesEditor
          fields={attributeFields}
          onChange={setAttributeFields}
          disabled={loading}
          helpText='Exemples selon votre activité : couture -> genre, sizes (S, M, L), colors ; commerce général -> brand, weight_kg ; produit numérique -> download_url, license.'
        />

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Création..." : "Créer le produit"}
        </button>
      </form>
    </div>
  );
}
