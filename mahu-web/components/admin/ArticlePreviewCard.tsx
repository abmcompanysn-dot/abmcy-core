"use client";

import { useRef, useState } from "react";

/** Carte d'aperçu "façon réseaux sociaux" + export JPG — portage de
 * admin.html:228-246 (updatePreview) et :534-553 (downloadPreviewJPG,
 * html2canvas). Une image de couverture externe (R2, picsum) posera un
 * canvas "tainted" pour html2canvas si le serveur ne renvoie pas de CORS
 * permissif — c'est un risque assumé de cette fonctionnalité annexe, pas
 * du contenu critique du site. Le paramètre de cache-bust (`?cb=...`)
 * force une requête réseau fraîche à chaque export : une image déjà en
 * cache CDN sans header CORS (mise en cache avant que la règle CORS du
 * bucket R2 soit configurée) resterait sans header tant qu'elle n'expire
 * pas naturellement — un cache-bust évite d'attendre ça. */
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

    // Clone hors-écran de la carte, avec l'image de couverture remplacée
    // par une balise <img crossOrigin="anonymous"> explicitement préchargée
    // avant d'appeler html2canvas — plus fiable qu'un simple
    // style.backgroundImage : html2canvas peut capturer le clone avant que
    // le navigateur ait fini de (re)télécharger un CSS background-image, ce
    // qui produit un canvas vide ou "tainted" même quand le serveur renvoie
    // bien les headers CORS. Le cache-bust (`?cb=...`) évite en plus de
    // retomber sur une réponse déjà en cache CDN sans header CORS (mise en
    // cache avant que la règle du bucket R2 soit configurée).
    const clone = cardRef.current.cloneNode(true) as HTMLElement;
    clone.style.position = "fixed";
    clone.style.left = "-9999px";
    clone.style.top = "0";
    document.body.appendChild(clone);

    try {
      if (coverImageUrl) {
        const sep = coverImageUrl.includes("?") ? "&" : "?";
        const bustedUrl = `${coverImageUrl}${sep}cb=${Date.now()}`;

        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.src = bustedUrl;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("image load failed"));
        });

        img.className = "absolute inset-0 h-full w-full object-cover";
        clone.style.backgroundImage = "none";
        clone.insertBefore(img, clone.firstChild);
      }

      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(clone, { useCORS: true });

      // Un blob + URL.createObjectURL est plus fiable qu'un lien data:
      // (base64) pour déclencher un téléchargement : les navigateurs
      // bloquent plus facilement les gros data: URLs générés par JS sans
      // interaction utilisateur directe suffisante.
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9)
      );
      if (!blob) throw new Error("canvas to blob failed");

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `mahu_apercu_${Date.now()}.jpg`;
      link.href = blobUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("export JPG failed:", err);
      setError(
        `Impossible de générer l'image : ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      clone.remove();
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
