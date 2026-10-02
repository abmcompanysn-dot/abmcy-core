"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, setTenantOwnerPassword } from "@/lib/api";
import { NewSecretModal } from "./NewSecretModal";

/** Génère un mot de passe aléatoire lisible (évite les caractères ambigus). */
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Même règle que côté backend (pkg/password) : au moins 8 caractères,
 * une lettre et un chiffre — vérifiée ici aussi pour éviter un aller-retour
 * réseau inutile sur un mot de passe visiblement trop faible. */
function isPasswordValid(pw: string): boolean {
  return pw.length >= 8 && /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw);
}

/**
 * Réinitialise le mot de passe du compte owner d'un tenant (ex : owner
 * bloqué, sans email fonctionnel pour un reset self-service) — soit un mot
 * de passe généré automatiquement (affiché une seule fois via
 * NewSecretModal), soit un mot de passe choisi par l'opérateur admin.
 * Jamais stocké ni renvoyé par le backend au-delà de cet appel.
 */
export function ResetOwnerPasswordButton({
  tenantId,
  tenantName,
}: {
  tenantId: string;
  tenantName: string;
}) {
  const { adminKey } = useAuth();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [customPassword, setCustomPassword] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);

  async function applyPassword(password: string) {
    if (!adminKey || saving) return;
    setSaving(true);
    try {
      await setTenantOwnerPassword(adminKey, tenantId, password);
      showToast("Mot de passe du owner mis à jour.", "success");
      return true;
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Impossible de mettre à jour le mot de passe.",
        "error"
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    if (
      !window.confirm(
        `Réinitialiser le mot de passe du compte owner de « ${tenantName} » avec un mot de passe généré automatiquement ? L'ancien mot de passe cessera immédiatement de fonctionner.`
      )
    ) {
      return;
    }
    const password = generatePassword();
    const ok = await applyPassword(password);
    if (ok) setNewPassword(password);
  }

  async function handleCustomSubmit(e: FormEvent) {
    e.preventDefault();
    setCustomError(null);
    if (!isPasswordValid(customPassword)) {
      setCustomError("Au moins 8 caractères, avec une lettre et un chiffre.");
      return;
    }
    const ok = await applyPassword(customPassword);
    if (ok) {
      setCustomMode(false);
      setCustomPassword("");
    }
  }

  if (customMode) {
    return (
      <form onSubmit={handleCustomSubmit} className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={customPassword}
          onChange={(e) => setCustomPassword(e.target.value)}
          placeholder="Nouveau mot de passe"
          autoFocus
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Valider"}
        </button>
        <button
          type="button"
          onClick={() => {
            setCustomMode(false);
            setCustomPassword("");
            setCustomError(null);
          }}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Annuler
        </button>
        {customError && <p className="w-full text-sm text-red-600">{customError}</p>}
      </form>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={saving}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
        >
          {saving ? "Réinitialisation..." : "Générer un mot de passe"}
        </button>
        <button
          type="button"
          onClick={() => setCustomMode(true)}
          disabled={saving}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
        >
          Définir un mot de passe
        </button>
      </div>
      {newPassword && (
        <NewSecretModal
          tenantName={tenantName}
          secret={newPassword}
          title={`Nouveau mot de passe — ${tenantName}`}
          onClose={() => setNewPassword(null)}
        />
      )}
    </>
  );
}
