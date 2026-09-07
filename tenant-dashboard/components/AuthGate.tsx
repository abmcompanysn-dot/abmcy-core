"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { LoginForm } from "./LoginForm";

/**
 * Affiche le formulaire de connexion tant qu'aucune clé API valide
 * n'est enregistrée, sinon affiche le contenu protégé.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { apiKey } = useAuth();

  if (!apiKey) {
    return <LoginForm />;
  }

  return <>{children}</>;
}
