"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  clearStoredApiKey,
  getStoredApiKey,
  listOrders,
  storeApiKey,
} from "./api";

interface AuthContextValue {
  /** Clé API tenant actuellement utilisée, ou null si non connecté. */
  apiKey: string | null;
  /** Tente une connexion avec la clé fournie ; lève une erreur si invalide. */
  login: (key: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// La clé API vit dans le localStorage du navigateur, une source externe
// à React. useSyncExternalStore lit cette source de façon sûre pour
// l'hydratation : rendu serveur et premier rendu client renvoient tous
// deux la valeur "non connecté" (getServerSnapshot), la vraie valeur du
// localStorage n'étant appliquée qu'une fois le composant monté côté client.
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyApiKeyChanged() {
  for (const listener of listeners) listener();
}

function getServerSnapshot(): string | null {
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const apiKey = useSyncExternalStore(
    subscribe,
    getStoredApiKey,
    getServerSnapshot
  );

  const login = useCallback(async (key: string) => {
    const trimmed = key.trim();
    if (!trimmed) {
      throw new Error("Veuillez saisir une clé API.");
    }
    // Vérifie la clé en appelant un endpoint protégé.
    await listOrders(trimmed);
    storeApiKey(trimmed);
    notifyApiKeyChanged();
  }, []);

  const logout = useCallback(() => {
    clearStoredApiKey();
    notifyApiKeyChanged();
  }, []);

  return (
    <AuthContext.Provider value={{ apiKey, login, logout }}>
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
