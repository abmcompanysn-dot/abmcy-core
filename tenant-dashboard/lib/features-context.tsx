"use client";

// Fournit l'état des fonctionnalités optionnelles du tenant (pour le
// moment, uniquement le catalogue) à toute l'application, une fois la
// clé API connue. Évite que chaque page/onglet catalogue refasse son
// propre GET /features et gère son propre état de chargement.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./auth-context";
import { getFeatures, type Features } from "./api";

interface FeaturesContextValue {
  /** null tant que /features n'a pas encore répondu. */
  features: Features | null;
  /** true pendant le chargement initial des fonctionnalités. */
  loading: boolean;
}

const FeaturesContext = createContext<FeaturesContextValue>({
  features: null,
  loading: false,
});

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const { apiKey } = useAuth();
  // On garde en état la dernière réponse reçue avec la clé API pour
  // laquelle elle a été obtenue. "loading" et "features" affichés sont
  // dérivés de la comparaison avec la clé actuelle, plutôt que mis à jour
  // de façon synchrone dans l'effet (même principe que app/page.tsx pour
  // les commandes) — ce que déconseille react-hooks/set-state-in-effect.
  const [result, setResult] = useState<{
    key: string;
    features: Features;
  } | null>(null);

  const loading = apiKey !== null && result?.key !== apiKey;
  const features = apiKey !== null && result?.key === apiKey ? result.features : null;

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    getFeatures(apiKey)
      .then((data) => {
        if (!cancelled) setResult({ key: apiKey, features: data });
      })
      .catch(() => {
        // En cas d'erreur, on suppose tous les services désactivés plutôt
        // que d'afficher des onglets qui échoueraient à l'usage.
        if (!cancelled) {
          setResult({
            key: apiKey,
            features: {
              products_enabled: false,
              fabrics_enabled: false,
              cart_enabled: false,
              gallery_enabled: false,
              reviews_enabled: false,
            },
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  return (
    <FeaturesContext.Provider value={{ features, loading }}>
      {children}
    </FeaturesContext.Provider>
  );
}

export function useFeatures(): FeaturesContextValue {
  return useContext(FeaturesContext);
}
