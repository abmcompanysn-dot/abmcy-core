import type { OrderStatus } from "@/lib/api";

export const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  paid: "Payée",
  in_progress: "En cours",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-blue-50 text-blue-700",
  paid: "bg-emerald-50 text-emerald-700",
  in_progress: "bg-sky-50 text-sky-700",
  shipped: "bg-violet-50 text-violet-700",
  delivered: "bg-teal-50 text-teal-700",
  cancelled: "bg-red-50 text-red-700",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const label = STATUS_LABELS[status] ?? status;
  const style = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {label}
    </span>
  );
}
