"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Détecte quand un élément entre dans le viewport, via IntersectionObserver.
 * Utilisé pour déclencher les animations d'entrée (fade/scale/translate) au
 * scroll plutôt qu'au chargement de la page.
 */
export function useInView<T extends HTMLElement>(options?: {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}) {
  const ref = useRef<T | null>(null);
  const [isInView, setIsInView] = useState(false);
  const { threshold = 0.2, rootMargin = "0px 0px -10% 0px", once = true } =
    options ?? {};

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Si IntersectionObserver n'est pas disponible (très vieux navigateur),
    // on affiche directement le contenu plutôt que de le laisser masqué.
    // setState est différé (queueMicrotask) pour éviter un rendu en cascade
    // synchrone depuis le corps de l'effet.
    if (typeof IntersectionObserver === "undefined") {
      queueMicrotask(() => setIsInView(true));
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setIsInView(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, isInView };
}
