import Link from "next/link";
import type { Order } from "@/lib/api";
import { formatDate, formatFCFA } from "@/lib/format";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { PaymentButton } from "./PaymentButton";

export function OrdersTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Aucune commande pour le moment. Créez votre première commande avec le
        bouton ci-dessus.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3 font-medium">N° commande</th>
            <th className="px-4 py-3 font-medium">Client</th>
            <th className="px-4 py-3 font-medium">Téléphone</th>
            <th className="px-4 py-3 font-medium">Montant</th>
            <th className="px-4 py-3 font-medium">Statut</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr
              key={order.id}
              className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
            >
              <td className="px-4 py-3 font-mono text-xs text-slate-700">
                <Link
                  href={`/commandes/${order.id}`}
                  className="text-indigo-600 hover:underline"
                >
                  {order.order_number}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-900">
                {order.customer_name}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {order.customer_phone}
              </td>
              <td className="px-4 py-3 font-medium text-slate-900">
                {formatFCFA(order.total_amount)}
              </td>
              <td className="px-4 py-3">
                <OrderStatusBadge status={order.status} />
              </td>
              <td className="px-4 py-3 text-slate-500">
                {formatDate(order.created_at)}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex flex-col items-end gap-2">
                  <Link
                    href={`/commandes/${order.id}`}
                    className="text-xs font-medium text-slate-500 hover:text-indigo-600 hover:underline"
                  >
                    Voir le détail
                  </Link>
                  <PaymentButton order={order} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
