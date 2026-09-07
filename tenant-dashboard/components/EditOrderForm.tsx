"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError, updateOrder, type Order } from "@/lib/api";

const EDITABLE_STATUSES = ["pending", "confirmed"];

/** Formulaire d'édition d'une commande encore modifiable (adresse, notes,
 * mesures). Le backend refuse la modification une fois la commande
 * validée (payée, en cours, etc.) — on n'affiche donc le formulaire que
 * pour pending/confirmed. */
export function EditOrderForm({
  order,
  onUpdated,
}: {
  order: Order;
  onUpdated: (order: Order) => void;
}) {
  const { apiKey } = useAuth();
  const [shippingAddress, setShippingAddress] = useState(
    order.shipping_address ?? ""
  );
  const [notes, setNotes] = useState(order.notes ?? "");
  const [measurementsText, setMeasurementsText] = useState(() =>
    order.measurements ? JSON.stringify(order.measurements, null, 2) : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const editable = EDITABLE_STATUSES.includes(order.status);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!apiKey) return;
    setError(null);
    setSuccess(false);

    let measurements: Record<string, unknown> | undefined;
    if (measurementsText.trim()) {
      try {
        measurements = JSON.parse(measurementsText);
      } catch {
        setError("Les mesures doivent être un JSON valide, ex: {\"taille\": 80}.");
        return;
      }
    }

    setLoading(true);
    try {
      const updated = await updateOrder(apiKey, order.id, {
        shipping_address: shippingAddress.trim() || undefined,
        notes: notes.trim() || undefined,
        measurements,
      });
      onUpdated(updated);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de modifier cette commande."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!editable) {
    return (
      <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-500">
        Cette commande a le statut &laquo;&nbsp;{order.status}&nbsp;&raquo; et
        ne peut plus être modifiée.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Adresse de livraison
        </label>
        <input
          type="text"
          value={shippingAddress}
          onChange={(e) => setShippingAddress(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          disabled={loading}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          disabled={loading}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Mesures (JSON)
        </label>
        <textarea
          value={measurementsText}
          onChange={(e) => setMeasurementsText(e.target.value)}
          rows={4}
          placeholder='{"poitrine": 90, "taille": 70}'
          className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          disabled={loading}
        />
        <p className="mt-1 text-xs text-slate-400">
          Laissez vide pour ne pas modifier les mesures existantes.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && !error && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Commande mise à jour.
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Enregistrement..." : "Enregistrer les modifications"}
      </button>
    </form>
  );
}
