"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Petite transition d'apparition à chaque changement de page — donne une
 * sensation "app mobile" plus fluide qu'un simple remplacement instantané
 * du contenu. Pure CSS (pas de librairie d'animation) : la clé sur le
 * pathname force React à remonter le conteneur, ce qui relance
 * l'animation définie dans globals.css. */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}
