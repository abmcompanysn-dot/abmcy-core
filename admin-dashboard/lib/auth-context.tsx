"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  adminLogin,
  clearStoredAdminKey,
  getStoredAdminKey,
  listTenants,
  storeAdminKey,
} from "./api";

interface AuthContextValue {
  /** Credential admin actuellement utilisée (JWT ou clé statique), ou null si non connecté. */
  adminKey: string | null;
  /** Email du compte connecté par mot de passe — null si connexion par X-Admin-Key
   *  (ce mode n'est rattaché à aucun compte précis) ou si non connecté. */
  adminEmail: string | null;
  /** Connexion via la clé X-Admin-Key statique (secours bootstrap). */
  login: (key: string) => Promise<void>;
  /** Connexion via email/mot de passe (compte créé avec POST /admin/accounts). */
  loginWithPassword: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ADMIN_EMAIL_STORAGE_KEY = "abmcy_admin_email";

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

function getStoredAdminEmail(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ADMIN_EMAIL_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const adminKey = useSyncExternalStore(
    subscribe,
    getStoredAdminKey,
    getServerSnapshot
  );
  const adminEmail = useSyncExternalStore(
    subscribe,
    getStoredAdminEmail,
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
    try {
      window.localStorage.removeItem(ADMIN_EMAIL_STORAGE_KEY);
    } catch {
      // ignore
    }
    notifyAdminKeyChanged();
  }, []);

  const loginWithPassword = useCallback(async (email: string, password: string) => {
    const trimmedEmail = email.trim();
    const token = await adminLogin(trimmedEmail, password);
    storeAdminKey(token);
    try {
      window.localStorage.setItem(ADMIN_EMAIL_STORAGE_KEY, trimmedEmail);
    } catch {
      // ignore
    }
    notifyAdminKeyChanged();
  }, []);

  const logout = useCallback(() => {
    clearStoredAdminKey();
    try {
      window.localStorage.removeItem(ADMIN_EMAIL_STORAGE_KEY);
    } catch {
      // ignore
    }
    notifyAdminKeyChanged();
  }, []);

  return (
    <AuthContext.Provider
      value={{ adminKey, adminEmail, login, loginWithPassword, logout }}
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
