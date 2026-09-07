"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  ApiError,
  getOrder,
  getOrderHistory,
  type Order,
  type OrderStatusEvent,
} from "@/lib/api";
import { formatDate, formatFCFA } from "@/lib/format";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { OrderHistoryTimeline } from "@/components/OrderHistoryTimeline";
import { EditOrderForm } from "@/components/EditOrderForm";
import { PaymentButton } from "@/components/PaymentButton";

const FABRIC_SOURCE_LABELS: Record<string, string> = {
  maison: "Tissu maison (catalogue)",
  envoi_photo: "Photo envoyée par le client",
  conseil_atelier: "Choix laissé à l'atelier",
};

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { apiKey } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<OrderStatusEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "loading" est dérivé de la comparaison entre la dernière requête
  // déclenchée et la dernière requête traitée, plutôt que mis à jour de
  // façon synchrone dans l'effet (voir app/page.tsx pour le même principe).
  const [reloadToken, setReloadToken] = useState(0);
  const [settledToken, setSettledToken] = useState(-1);
  const loading = settledToken !== reloadToken;

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    Promise.all([getOrder(apiKey, id), getOrderHistory(apiKey, id)])
      .then(([o, h]) => {
        if (cancelled) return;
        setOrder(o);
        setHistory(h);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger cette commande."
        );
      })
      .finally(() => {
        if (!cancelled) setSettledToken(reloadToken);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, id, reloadToken]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          &larr; Retour aux commandes
        </Link>
        <button
          onClick={() => setReloadToken((t) => t + 1)}
          disabled={loading}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
        >
          {loading ? "Actualisation..." : "Actualiser"}
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && !order ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Chargement de la commande...
        </div>
      ) : order ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-semibold text-slate-900">
                {order.order_number}
                <OrderStatusBadge status={order.status} />
              </h1>
              <p className="text-sm text-slate-500">
                Créée le {formatDate(order.created_at)}
              </p>
            </div>
            <PaymentButton order={order} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-medium text-slate-700">
                  Informations client
                </h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Nom</dt>
                    <dd className="text-right text-slate-900">
                      {order.customer_name}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Téléphone</dt>
                    <dd className="text-right text-slate-900">
                      {order.customer_phone}
                    </dd>
                  </div>
                  {order.customer_email && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Email</dt>
                      <dd className="text-right text-slate-900">
                        {order.customer_email}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Montant</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {formatFCFA(order.total_amount)}
                    </dd>
                  </div>
                  {order.shipping_address && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Adresse de livraison</dt>
                      <dd className="text-right text-slate-900">
                        {order.shipping_address}
                      </dd>
                    </div>
                  )}
                  {order.fabric_source && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Tissu</dt>
                      <dd className="text-right text-slate-900">
                        {FABRIC_SOURCE_LABELS[order.fabric_source] ??
                          order.fabric_source}
                      </dd>
                    </div>
                  )}
                  {order.notes && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Notes</dt>
                      <dd className="text-right text-slate-900">
                        {order.notes}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>

              {order.measurements &&
                Object.keys(order.measurements).length > 0 && (
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-sm font-medium text-slate-700">
                      Mesures
                    </h2>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {Object.entries(order.measurements).map(
                        ([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <dt className="text-slate-500">{key}</dt>
                            <dd className="text-slate-900">
                              {String(value)}
                            </dd>
                          </div>
                        )
                      )}
                    </dl>
                  </section>
                )}

              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-medium text-slate-700">
                  Modifier la commande
                </h2>
                <EditOrderForm order={order} onUpdated={setOrder} />
              </section>
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-medium text-slate-700">
                Historique des statuts
              </h2>
              <OrderHistoryTimeline events={history ?? []} />
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
