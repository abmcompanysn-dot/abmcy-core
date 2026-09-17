"use client";

import { useState } from "react";
import Link from "next/link";
import type { Order } from "@/lib/api";
import { formatDate, formatFCFA } from "@/lib/format";
import { OrderStatusSelect } from "./OrderStatusSelect";
import { PaymentButton } from "./PaymentButton";

/** Version mobile de OrdersTable : une carte par commande plutôt qu'un
 * tableau à faire défiler horizontalement. Même logique de mise à jour
 * inline du statut. */
export function OrdersCardList({ orders }: { orders: Order[] }) {
  const [overrides, setOverrides] = useState<Record<string, Order>>({});

  function handleUpdated(updated: Order) {
    setOverrides((prev) => ({ ...prev, [updated.id]: updated }));
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Aucune commande pour le moment. Créez votre première commande avec le
        bouton ci-dessus.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const current = overrides[order.id] ?? order;
        return (
          <div
            key={order.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/commandes/${order.id}`}
                  className="font-mono text-xs font-medium text-indigo-600 hover:underline"
                >
                  {order.order_number}
                </Link>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                  {order.customer_name}
                </p>
                <p className="text-xs text-slate-500">{order.customer_phone}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-slate-900">
                  {formatFCFA(order.total_amount)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatDate(order.created_at)}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <OrderStatusSelect order={current} onUpdated={handleUpdated} />
              <div className="flex items-center gap-3">
                <PaymentButton order={current} />
                <Link
                  href={`/commandes/${order.id}`}
                  className="text-xs font-medium text-slate-500 hover:text-indigo-600 hover:underline"
                >
                  Détail
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
