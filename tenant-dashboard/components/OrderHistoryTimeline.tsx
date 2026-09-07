import type { OrderStatusEvent } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { OrderStatusBadge } from "./OrderStatusBadge";

export function OrderHistoryTimeline({
  events,
}: {
  events: OrderStatusEvent[];
}) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun historique disponible pour cette commande.
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {events.map((event, index) => (
        <li key={index} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-500" />
            {index < events.length - 1 && (
              <span className="mt-1 w-px flex-1 bg-slate-200" />
            )}
          </div>
          <div className="pb-4">
            <div className="flex items-center gap-2">
              <OrderStatusBadge status={event.status} />
              <span className="text-xs text-slate-400">
                {formatDate(event.created_at)}
              </span>
            </div>
            {event.comment && (
              <p className="mt-1 text-sm text-slate-600">{event.comment}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
