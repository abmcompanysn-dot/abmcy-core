"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { LoginForm } from "./LoginForm";

/**
 * Affiche le formulaire de connexion tant qu'aucune clé API valide
 * n'est enregistrée, sinon affiche le contenu protégé.
 *
 * Supporte aussi l'arrivée depuis le bouton "Se connecter en tant que"
 * de l'admin-dashboard : ?impersonate_token=<jwt> dans l'URL adopte
 * directement ce JWT (déjà signé et vérifié côté backend, pas besoin de
 * revalider) puis nettoie l'URL pour ne pas laisser le token dans
 * l'historique du navigateur.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { apiKey, adoptToken } = useAuth();
  const [hasImpersonateParam] = useState(
    () =>
      typeof window !== "undefined" &&
      new URL(window.location.href).searchParams.has("impersonate_token")
  );

  useEffect(() => {
    function applyImpersonationToken() {
      const url = new URL(window.location.href);
      const token = url.searchParams.get("impersonate_token");
      if (!token) return;
      adoptToken(token);
      url.searchParams.delete("impersonate_token");
      window.history.replaceState({}, "", url.toString());
    }
    applyImpersonationToken();
  }, [adoptToken]);

  // Le paramètre était présent au premier rendu : on attend qu'adoptToken
  // ait posé la nouvelle credential (effet ci-dessus) avant d'afficher le
  // formulaire de connexion, pour éviter un flash "non connecté".
  if (hasImpersonateParam && !apiKey) {
    return null;
  }

  if (!apiKey) {
    return <LoginForm />;
  }

  return <>{children}</>;
}
