"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  clearStoredToken,
  getStoredToken,
  staffLogin,
  staffLogout,
  storeToken,
} from "./admin-api";

interface AuthContextValue {
  /** JWT staff actuellement utilisé, ou null si non connecté. */
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Le JWT vit dans le localStorage du navigateur, une source externe à React.
// useSyncExternalStore le lit de façon sûre pour l'hydratation : rendu
// serveur et premier rendu client renvoient tous deux "non connecté"
// (getServerSnapshot), la vraie valeur du localStorage n'étant appliquée
// qu'une fois le composant monté côté client — même pattern que
// tenant-dashboard/lib/auth-context.tsx.
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyTokenChanged() {
  for (const listener of listeners) listener();
}

function getServerSnapshot(): string | null {
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const token = useSyncExternalStore(subscribe, getStoredToken, getServerSnapshot);

  const login = useCallback(async (email: string, password: string) => {
    const jwt = await staffLogin(email.trim(), password);
    storeToken(jwt);
    notifyTokenChanged();
  }, []);

  const logout = useCallback(() => {
    // Révocation serveur (vrai logout, voir POST /auth/logout) —
    // best-effort : la déconnexion locale doit réussir même si l'appel
    // réseau échoue (session déjà expirée, backend injoignable, etc.).
    const current = getStoredToken();
    if (current) {
      staffLogout(current).catch(() => {
        // Ignoré volontairement — voir commentaire ci-dessus.
      });
    }
    clearStoredToken();
    notifyTokenChanged();
  }, []);

  return (
    <AuthContext.Provider value={{ token, login, logout }}>
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
