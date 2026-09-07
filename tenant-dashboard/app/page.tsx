"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError, listOrders, type Order } from "@/lib/api";
import { NewOrderForm } from "@/components/NewOrderForm";
import { OrdersTable } from "@/components/OrdersTable";

export default function OrdersPage() {
  const { apiKey } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Incrémenté pour déclencher un rechargement (montage initial + bouton
  // "Actualiser"). "loading" est dérivé de la comparaison avec le dernier
  // token traité, plutôt que d'être mis à jour de façon synchrone dans
  // l'effet (ce que déconseille la règle react-hooks/set-state-in-effect).
  const [reloadToken, setReloadToken] = useState(0);
  const [settledToken, setSettledToken] = useState(-1);
  const loading = settledToken !== reloadToken;

  // Chargement des commandes au montage, si la clé API change, ou lors
  // d'un rechargement manuel. Le drapeau d'annulation évite toute mise à
  // jour d'état sur un composant démonté ou un effet obsolète.
  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    listOrders(apiKey)
      .then((data) => {
        if (cancelled) return;
        setOrders(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger la liste des commandes."
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

  function handleCreated(order: Order) {
    setOrders((prev) => (prev ? [order, ...prev] : [order]));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Commandes
          </h1>
          <p className="text-sm text-slate-500">
            Consultez et gérez les commandes de vos clients.
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

      <NewOrderForm onCreated={handleCreated} />

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && orders === null ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Chargement des commandes...
        </div>
      ) : (
        <OrdersTable orders={orders ?? []} />
      )}
    </div>
  );
}
