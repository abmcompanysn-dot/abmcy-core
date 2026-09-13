"use client";

// Bibliothèque d'images de secours par thème (photos Unsplash, licence
// libre), pour un article sans vraie photo sous la main — remplace les
// images aléatoires picsum.photos de l'ancien admin.html:174-181 par de
// vraies photos éditoriales. Unsplash Source (recherche dynamique par
// mot-clé) a été déprécié par Unsplash ; ce sont donc des photo IDs fixes
// choisis à l'avance plutôt qu'une recherche en direct. Ce ne sont que des
// images génériques de substitution, pas du contenu éditorial réel :
// l'upload direct (ArticleForm) reste le chemin normal.
const LIBRARY_IMAGES = [
  { id: "1541872703-74c5e44368f9", label: "Politique" },
  { id: "1518770660439-4636190af475", label: "Technologie" },
  { id: "1523805009345-7448845a9e53", label: "Afrique" },
  { id: "1454165804606-c3d57bc86b40", label: "Business" },
  { id: "1461896836934-ffe607ba8211", label: "Sport" },
];

function unsplashUrl(id: string, width: number, height: number): string {
  return `https://images.unsplash.com/photo-${id}?w=${width}&h=${height}&fit=crop&auto=format`;
}

export default function ImageLibraryPicker({
  selectedUrl,
  onSelect,
}: {
  selectedUrl: string;
  onSelect: (url: string) => void;
}) {
  return (
    <div className="mt-3">
      <p className="mb-2 text-xs text-[var(--text-muted)]">
        Image de secours par thème (à défaut d&apos;une vraie photo)
      </p>
      <div className="flex flex-wrap gap-2">
        {LIBRARY_IMAGES.map((img) => {
          const url = unsplashUrl(img.id, 800, 600);
          const selected = selectedUrl === url;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={img.id}
              src={unsplashUrl(img.id, 120, 90)}
              alt={img.label}
              title={img.label}
              onClick={() => onSelect(url)}
              className={`h-16 w-20 cursor-pointer rounded object-cover ${
                selected
                  ? "ring-2 ring-[var(--accent-red)]"
                  : "opacity-80 hover:opacity-100"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
