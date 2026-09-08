"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError, API_URL } from "@/lib/api";

export function LoginForm() {
  const { login, loginWithPassword } = useAuth();
  const [mode, setMode] = useState<"password" | "key">("password");

  const [tenantSlug, setTenantSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [key, setKey] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function describeError(err: unknown, invalidMessage: string): string {
    if (err instanceof ApiError) {
      if (err.status === 403 || err.status === 401) return invalidMessage;
      return err.message;
    }
    if (err instanceof Error) return err.message;
    return "Une erreur inconnue est survenue.";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "password") {
        await loginWithPassword(tenantSlug, email, password);
      } else {
        await login(key);
      }
    } catch (err) {
      setError(
        describeError(
          err,
          mode === "password"
            ? "Identifiant boutique, email ou mot de passe incorrect."
            : "Clé API invalide. Vérifiez la clé et réessayez."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    mode === "password"
      ? Boolean(tenantSlug.trim() && email.trim() && password)
      : Boolean(key.trim());

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">
          ABMCY <span className="text-indigo-600">Dashboard</span>
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Connectez-vous pour gérer vos commandes.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "password" ? (
            <>
              <div>
                <label
                  htmlFor="tenant-slug"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Identifiant de votre boutique
                </label>
                <input
                  id="tenant-slug"
                  type="text"
                  autoComplete="organization"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  placeholder="hanis"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label
                  htmlFor="staff-email"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Email
                </label>
                <input
                  id="staff-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label
                  htmlFor="staff-password"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Mot de passe
                </label>
                <input
                  id="staff-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  disabled={loading}
                />
              </div>
            </>
          ) : (
            <div>
              <label
                htmlFor="api-key"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Clé API (X-API-Key)
              </label>
              <input
                id="api-key"
                type="password"
                autoComplete="off"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="pk_live_..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-slate-400">
                Cette clé vous a été communiquée lors de la création de votre
                boutique — réservée à l&apos;intégration technique (votre
                site, vos scripts).
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Vérification..." : "Se connecter"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "password" ? "key" : "password");
            setError(null);
          }}
          className="mt-4 text-xs font-medium text-indigo-600 hover:text-indigo-700"
        >
          {mode === "password"
            ? "Se connecter avec la clé API à la place"
            : "Se connecter avec email / mot de passe à la place"}
        </button>

        <p className="mt-4 text-xs text-slate-400">
          API : <span className="font-mono">{API_URL}</span>
        </p>
      </div>
    </div>
  );
}
