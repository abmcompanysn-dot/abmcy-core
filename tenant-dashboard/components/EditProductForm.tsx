"use client";

import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, updateProduct, uploadImage, type Product } from "@/lib/api";
import {
  AttributesEditor,
  attributeFieldsToObject,
  objectToAttributeFields,
  type AttributeField,
} from "./AttributesEditor";

/**
 * Formulaire d'édition d'un produit existant, en modal — remplace le
 * détour obligatoire par la page Photos + copier-coller d'URL que le
 * client signalait : l'upload se fait ici directement, attaché au
 * produit via POST /uploads/image?product_id=... .
 */
export function EditProductForm({
  product,
  onUpdated,
  onClose,
}: {
  product: Product;
  onUpdated: (product: Product) => void;
  onClose: () => void;
}) {
  const { apiKey } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [price, setPrice] = useState(String(product.price));
  const [category, setCategory] = useState(product.category ?? "");
  const [sku, setSku] = useState(product.sku ?? "");
  const [stockQuantity, setStockQuantity] = useState(
    product.stock_quantity != null ? String(product.stock_quantity) : ""
  );
  const [isFeatured, setIsFeatured] = useState(product.is_featured);
  const [isActive, setIsActive] = useState(product.is_active);
  const [attributeFields, setAttributeFields] = useState<AttributeField[]>(
    () => objectToAttributeFields(product.attributes)
  );
  const [images, setImages] = useState(product.images ?? []);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !apiKey) return;
    setError(null);
    setUploading(true);
    try {
      const uploaded = await uploadImage(apiKey, file, product.id);
      setImages((prev) => [...prev, { id: uploaded.id, url: uploaded.url }]);
      showToast("Photo ajoutée au produit.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible d'envoyer la photo."
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!apiKey) return;
    setError(null);

    const priceNum = Number(price);
    if (!name.trim() || !Number.isFinite(priceNum) || priceNum <= 0) {
      setError("Nom et prix (nombre supérieur à 0) sont obligatoires.");
      return;
    }
    let stockQuantityNum: number | null | undefined;
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
      const updated = await updateProduct(apiKey, product.id, {
        name: name.trim(),
        description: description.trim(),
        price: Math.round(priceNum),
        category: category.trim(),
        sku: sku.trim(),
        stock_quantity: stockQuantityNum,
        attributes,
        is_featured: isFeatured,
        is_active: isActive,
      });
      onUpdated({ ...updated, images });
      showToast("Produit mis à jour avec succès.");
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible de modifier le produit."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Modifier le produit
          </h2>
          <button
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            Fermer
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Photos
            </label>
            <div className="flex flex-wrap gap-2">
              {images.map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={img.id}
                  src={img.url}
                  alt={product.name}
                  className="h-16 w-16 rounded-md border border-slate-200 object-cover"
                />
              ))}
              <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-400 hover:border-indigo-400 hover:text-indigo-600">
                {uploading ? "…" : "+ Ajouter"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={uploading || loading}
                  className="hidden"
                />
              </label>
            </div>
          </div>

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
            <div className="flex items-center gap-4 pt-6">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  disabled={loading}
                />
                Mise en avant
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  disabled={loading}
                />
                Actif (visible)
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
          />

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Enregistrement..." : "Enregistrer les modifications"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-slate-500 hover:text-slate-700"
              disabled={loading}
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
