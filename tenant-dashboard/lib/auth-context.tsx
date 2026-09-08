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
  isJwt,
  listOrders,
  staffLogin,
  staffLogout,
  storeApiKey,
} from "./api";

interface AuthContextValue {
  /** Credential tenant actuellement utilisée (clé API ou JWT), ou null si non connecté. */
  apiKey: string | null;
  /** true si la connexion actuelle est un JWT staff (email/mot de passe),
   * false si c'est la clé API technique (X-API-Key). Détermine l'accès aux
   * routes réservées au personnel identifié (ex: /staff, gestion d'équipe). */
  isStaffSession: boolean;
  /** Connexion via la clé X-API-Key (intégration technique). */
  login: (key: string) => Promise<void>;
  /** Connexion via identifiant boutique + email/mot de passe (compte personnel). */
  loginWithPassword: (
    tenantSlug: string,
    email: string,
    password: string
  ) => Promise<void>;
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

  const loginWithPassword = useCallback(
    async (tenantSlug: string, email: string, password: string) => {
      const token = await staffLogin(tenantSlug.trim(), email.trim(), password);
      storeApiKey(token);
      notifyApiKeyChanged();
    },
    []
  );

  const logout = useCallback(() => {
    // Révocation serveur du JWT (vrai logout, voir POST /auth/logout et
    // internal/auth/service.go Logout) — best-effort : la déconnexion
    // locale doit réussir même si l'appel réseau échoue (session déjà
    // expirée, backend injoignable, etc.). Sans objet pour une session par
    // clé API : rien à révoquer côté serveur.
    const current = getStoredApiKey();
    if (current && isJwt(current)) {
      staffLogout(current).catch(() => {
        // Ignoré volontairement — voir commentaire ci-dessus.
      });
    }
    clearStoredApiKey();
    notifyApiKeyChanged();
  }, []);

  const isStaffSession = apiKey !== null && isJwt(apiKey);

  return (
    <AuthContext.Provider
      value={{ apiKey, isStaffSession, login, loginWithPassword, logout }}
    >
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
