"use client";

// Protège les pages catalogue (produits, tissus, galerie, avis) contre un
// accès direct par URL quand le tenant n'a pas le feature flag
// catalog_enabled — sinon la page tenterait des appels qui échouent tous
// avec 403 catalog_not_enabled, pour un rendu à moitié cassé.

import type { ReactNode } from "react";
import { useFeatures } from "@/lib/features-context";

export function CatalogGate({ children }: { children: ReactNode }) {
  const { features, loading } = useFeatures();

  if (loading && !features) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Vérification de vos fonctionnalités...
      </div>
    );
  }

  if (!features?.catalog_enabled) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-10 text-center">
        <h1 className="text-lg font-semibold text-amber-900">
          Catalogue non activé
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
