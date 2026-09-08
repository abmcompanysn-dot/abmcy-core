"use client";

// Protège une page catalogue (produits, tissus, galerie, avis) contre un
// accès direct par URL quand le service correspondant n'est pas activé
// pour ce tenant — sinon la page tenterait des appels qui échouent tous
// avec un 403 "xxx_not_enabled", pour un rendu à moitié cassé. Chaque
// page passe la clé du service qu'elle représente (voir Features dans
// lib/api.ts) puisque les cinq services sont désormais indépendants.

import type { ReactNode } from "react";
import { useFeatures } from "@/lib/features-context";
import { FEATURE_LABELS, type Features } from "@/lib/api";

export function CatalogGate({
  feature,
  children,
}: {
  feature: keyof Features;
  children: ReactNode;
}) {
  const { features, loading } = useFeatures();

  if (loading && !features) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Vérification de vos fonctionnalités...
      </div>
    );
  }

  if (!features?.[feature]) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-10 text-center">
        <h1 className="text-lg font-semibold text-amber-900">
          {FEATURE_LABELS[feature]} non activé
        </h1>
        <p className="mt-2 text-sm text-amber-700">
          Cette fonctionnalité n&apos;est pas activée pour votre compte.
          Contactez ABMCY pour l&apos;activer.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
