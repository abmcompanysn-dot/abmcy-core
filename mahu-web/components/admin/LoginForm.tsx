"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

export default function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Connexion impossible."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 sm:px-8">
      <form
        onSubmit={handleSubmit}
        className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-card)] p-8"
      >
        <h1 className="mb-1 font-[family-name:var(--font-display)] text-2xl text-[var(--text-main)]">
          Admin MAHU
        </h1>
        <p className="mb-6 text-sm text-[var(--text-muted)]">
          Accès réservé à l&apos;équipe éditoriale.
        </p>

        {error ? (
          <div className="mb-4 rounded border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 p-3 text-sm text-[var(--text-main)]">
            {error}
          </div>
        ) : null}

        <label className="mb-3 block text-sm text-[var(--text-muted)]">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-main)]"
          />
        </label>

        <label className="mb-6 block text-sm text-[var(--text-muted)]">
          Mot de passe
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-main)]"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-[var(--accent-red)] py-2.5 font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </main>
  );
}
