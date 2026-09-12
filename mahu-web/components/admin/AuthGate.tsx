"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import LoginForm from "./LoginForm";

/** Affiche le formulaire de connexion tant qu'aucun JWT staff valide n'est
 * enregistré, sinon affiche le contenu protégé. */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { token } = useAuth();

  if (!token) {
    return <LoginForm />;
  }

  return <>{children}</>;
}
