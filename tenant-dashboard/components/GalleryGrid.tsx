import type { GalleryPhoto } from "@/lib/api";

const CATEGORY_LABELS: Record<string, string> = {
  femme: "Femme",
  homme: "Homme",
  sur_mesure: "Sur mesure",
  artisanat: "Artisanat",
};

export function GalleryGrid({ photos }: { photos: GalleryPhoto[] }) {
  if (photos.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Aucune photo dans cette catégorie pour le moment.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.image_url}
            alt={photo.caption || "Photo de réalisation"}
            className="h-40 w-full object-cover"
          />
          <div className="space-y-1 p-3">
            {photo.category && (
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {CATEGORY_LABELS[photo.category] ?? photo.category}
              </span>
            )}
            {photo.caption && (
              <p className="text-xs text-slate-500">{photo.caption}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
