"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { LoginForm } from "./LoginForm";

/**
 * Affiche le formulaire de connexion tant qu'aucune clé admin valide
 * n'est enregistrée, sinon affiche le contenu protégé.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { adminKey } = useAuth();

  if (!adminKey) {
    return <LoginForm />;
  }

  return <>{children}</>;
}
