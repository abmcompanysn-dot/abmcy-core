"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  clearStoredAdminKey,
  getStoredAdminKey,
  listTenants,
  storeAdminKey,
} from "./api";

interface AuthContextValue {
  /** Clé admin actuellement utilisée, ou null si non connecté. */
  adminKey: string | null;
  /** Tente une connexion avec la clé fournie ; lève une erreur si invalide. */
  login: (key: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// La clé admin vit dans le localStorage du navigateur, une source externe
// à React. useSyncExternalStore lit cette source de façon sûre pour
// l'hydratation : rendu serveur et premier rendu client renvoient tous
// deux la valeur "non connecté" (getServerSnapshot), la vraie valeur du
// localStorage n'étant appliquée qu'une fois le composant monté côté client.
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyAdminKeyChanged() {
  for (const listener of listeners) listener();
}

function getServerSnapshot(): string | null {
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const adminKey = useSyncExternalStore(
    subscribe,
    getStoredAdminKey,
    getServerSnapshot
  );

  const login = useCallback(async (key: string) => {
    const trimmed = key.trim();
    if (!trimmed) {
      throw new Error("Veuillez saisir une clé admin.");
    }
    // Vérifie la clé en appelant un endpoint protégé.
    await listTenants(trimmed);
    storeAdminKey(trimmed);
    notifyAdminKeyChanged();
  }, []);

  const logout = useCallback(() => {
    clearStoredAdminKey();
    notifyAdminKeyChanged();
  }, []);

  return (
    <AuthContext.Provider value={{ adminKey, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth doit être utilisé dans un <AuthProvider>.");
  }
  return ctx;
}
