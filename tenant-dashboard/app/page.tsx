"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError, ORDER_STATUSES, listOrders, type Order } from "@/lib/api";
import { STATUS_LABELS } from "@/components/OrderStatusBadge";
import { NewOrderForm } from "@/components/NewOrderForm";
import { OrdersTable } from "@/components/OrdersTable";
import { LoadingBlock } from "@/components/Spinner";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Tous" },
  ...ORDER_STATUSES.map((status) => ({
    value: status,
    label: STATUS_LABELS[status] ?? status,
  })),
];

export default function OrdersPage() {
  const { apiKey } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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

  // Filtrage côté client : GET /orders n'est pas paginé côté API pour le
  // moment (voir lib/api.ts listOrders), donc filtrer la liste déjà
  // chargée est suffisant plutôt que de repenser la pagination serveur.
  const filteredOrders = useMemo(() => {
    if (!orders) return orders;
    const term = search.trim().toLowerCase();

    return orders.filter((order) => {
      if (statusFilter && order.status !== statusFilter) return false;

      if (term) {
        const haystack = [
          order.order_number,
          order.customer_name,
          order.customer_phone,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      const createdAt = new Date(order.created_at);
      if (dateFrom && createdAt < new Date(dateFrom)) return false;
      if (dateTo) {
        // Inclut toute la journée de fin sélectionnée.
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (createdAt > end) return false;
      }

      return true;
    });
  }, [orders, search, statusFilter, dateFrom, dateTo]);

  const hasActiveFilters = Boolean(
    search.trim() || statusFilter || dateFrom || dateTo
  );

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
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

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Rechercher
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, téléphone ou n° de commande"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Depuis le
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Jusqu&apos;au
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-500 hover:text-indigo-600 hover:underline"
            >
              Réinitialiser
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && orders === null ? (
        <LoadingBlock label="Chargement des commandes..." />
      ) : (
        <>
          {hasActiveFilters && filteredOrders && (
            <p className="text-xs text-slate-500">
              {filteredOrders.length} commande
              {filteredOrders.length !== 1 ? "s" : ""} trouvée
              {filteredOrders.length !== 1 ? "s" : ""} sur {orders?.length ?? 0}.
            </p>
          )}
          <OrdersTable orders={filteredOrders ?? []} />
        </>
      )}
    </div>
  );
}
