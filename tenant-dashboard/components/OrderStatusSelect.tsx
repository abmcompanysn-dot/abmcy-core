"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, ORDER_STATUSES, updateOrderStatus, type Order } from "@/lib/api";
import { STATUS_LABELS } from "./OrderStatusBadge";

/**
 * Sélecteur inline de statut de commande — utilisé aussi bien dans
 * OrdersTable (liste) que sur la page de détail. Le changement reste
 * possible quel que soit le statut actuel de la commande (contrairement à
 * l'édition adresse/mesures/notes) : c'est justement l'action qui fait
 * avancer la commande dans le pipeline. Voir PATCH /orders/{id}/status
 * côté backend.
 */
export function OrderStatusSelect({
  order,
  onUpdated,
}: {
  order: Order;
  onUpdated: (order: Order) => void;
}) {
  const { apiKey } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(newStatus: string) {
    if (!apiKey || newStatus === order.status) return;
    setError(null);
    setLoading(true);
    try {
      const updated = await updateOrderStatus(apiKey, order.id, newStatus);
      onUpdated(updated);
      showToast(
        `Statut de la commande ${order.order_number} mis à jour : ${STATUS_LABELS[newStatus] ?? newStatus}.`
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de changer le statut de cette commande."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <select
        value={order.status}
        onChange={(e) => handleChange(e.target.value)}
        disabled={loading}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
      >
        {ORDER_STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status] ?? status}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
