"use client";

import { useEffect, useRef } from "react";
import { incrementView } from "@/lib/api";

/** Déclenche l'incrémentation du compteur de vues côté client, une seule
 * fois au montage — extrait de la page article (Server Component depuis
 * l'ajout de generateMetadata pour l'Open Graph, voir
 * app/articles/[id]/page.tsx) puisque ceci reste un effet de bord client. */
export default function ArticleViewTracker({ id }: { id: string }) {
  const viewedRef = useRef(false);

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    incrementView(id).catch(() => {
      // best-effort — un compteur de vues raté ne doit jamais empêcher la
      // lecture de l'article.
    });
  }, [id]);

  return null;
}
