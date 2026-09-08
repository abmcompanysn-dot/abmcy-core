"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, createAdminAccount, type AdminAccount } from "@/lib/api";

/**
 * Formulaire de création d'un nouveau compte super-admin ABMCY (ex: un
 * collègue qui rejoint l'équipe). Le mot de passe est saisi ici — pas
 * généré automatiquement, pour rester simple : la personne qui crée le
 * compte le communique elle-même à son collègue par un canal sûr.
 */
export function CreateAdminAccountForm({
  onCreated,
}: {
  onCreated: (account: AdminAccount) => void;
}) {
  const { adminKey } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!adminKey) return;
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || password.length < 8) {
      setError("Email requis et mot de passe d'au moins 8 caractères.");
      return;
    }

    setLoading(true);
    try {
      const account = await createAdminAccount(adminKey, trimmedEmail, password);
      onCreated(account);
      showToast(`Compte « ${account.email} » créé.`, "success");
      setEmail("");
      setPassword("");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Une erreur inconnue est survenue lors de la création.";
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-5"
    >
      <h2 className="text-base font-semibold text-slate-900">
        Créer un compte admin
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Donne à un collègue ABMCY son propre accès au dashboard admin, en
        plus de la clé X-Admin-Key partagée.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label
            htmlFor="account-email"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Email
          </label>
          <input
            id="account-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="collegue@abmcy.com"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            disabled={loading}
          />
        </div>
        <div>
          <label
            htmlFor="account-password"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Mot de passe
          </label>
          <input
            id="account-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8 caractères minimum"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !email.trim() || password.length < 8}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Création..." : "Créer le compte"}
        </button>
      </div>
      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
