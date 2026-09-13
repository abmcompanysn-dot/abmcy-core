"use client";

import { useRef, useState } from "react";

/** Carte d'aperçu "façon réseaux sociaux" + export JPG — portage de
 * admin.html:228-246 (updatePreview) et :534-553 (downloadPreviewJPG,
 * html2canvas). Une image de couverture externe (R2, picsum) posera un
 * canvas "tainted" pour html2canvas si le serveur ne renvoie pas de CORS
 * permissif — c'est un risque assumé de cette fonctionnalité annexe, pas
 * du contenu critique du site. */
export default function ArticlePreviewCard({
  title,
  category,
  excerpt,
  coverImageUrl,
}: {
  title: string;
  category: string;
  excerpt: string;
  coverImageUrl: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadJPG() {
    if (!cardRef.current) return;
    setError(null);
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, { useCORS: true });
      const link = document.createElement("a");
      link.download = `mahu_apercu_${Date.now()}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.9);
      link.click();
    } catch {
      setError(
        "Impossible de générer l'image (souvent dû à une image de couverture externe qui bloque l'export). Réessayez avec une image téléversée."
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <div
        ref={cardRef}
        className="relative flex h-64 flex-col justify-end overflow-hidden rounded bg-[var(--bg-primary)] bg-cover bg-center p-5"
        style={{
          backgroundImage: coverImageUrl ? `url(${coverImageUrl})` : undefined,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        <div className="relative z-10">
          {category ? (
            <span className="mb-2 inline-block bg-[var(--accent-red)] px-2 py-1 text-[0.65rem] font-bold text-white uppercase">
              {category}
            </span>
          ) : null}
          <h4 className="font-[family-name:var(--font-display)] text-lg leading-tight text-white">
            {title || "Titre de l'article"}
          </h4>
          {excerpt ? (
            <p className="mt-1 line-clamp-2 text-xs text-white/80">{excerpt}</p>
          ) : null}
          <p className="mt-2 text-[0.65rem] font-bold text-white/60">MAHU</p>
        </div>
      </div>

      <button
        type="button"
        onClick={downloadJPG}
        disabled={downloading}
        className="mt-3 rounded border border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-main)] disabled:opacity-60"
      >
        {downloading ? "Génération..." : "⬇ Télécharger l'aperçu en JPG"}
      </button>

      {error ? (
        <p className="mt-2 text-xs text-[var(--accent-red)]">{error}</p>
      ) : null}
    </div>
  );
}
