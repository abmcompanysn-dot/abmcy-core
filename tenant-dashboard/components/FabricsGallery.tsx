import type { Fabric } from "@/lib/api";
import { formatFCFA } from "@/lib/format";

export function FabricsGallery({ fabrics }: { fabrics: Fabric[] }) {
  if (fabrics.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Aucun tissu pour le moment. Ajoutez votre premier tissu avec le
        bouton ci-dessus.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {fabrics.map((fabric) => (
        <div
          key={fabric.id}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          {fabric.image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={fabric.image_url}
              alt={fabric.name}
              className="h-32 w-full object-cover"
            />
          ) : (
            <div className="flex h-32 w-full items-center justify-center bg-slate-100 text-xs text-slate-400">
              Pas de photo
            </div>
          )}
          <div className="space-y-1 p-3">
            <p className="truncate text-sm font-medium text-slate-900">
              {fabric.name}
            </p>
            {fabric.description && (
              <p className="line-clamp-2 text-xs text-slate-500">
                {fabric.description}
              </p>
            )}
            <p className="text-xs font-medium text-indigo-600">
              {fabric.extra_price > 0
                ? `+ ${formatFCFA(fabric.extra_price)}`
                : "Sans supplément"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
