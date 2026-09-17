"use client";

import { useState } from "react";
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

/**
 * Réinitialise le mot de passe du compte owner d'un tenant (ex : owner
 * bloqué, sans email fonctionnel pour un reset self-service). Le nouveau
 * mot de passe est généré côté navigateur et affiché une seule fois via
 * NewSecretModal — jamais stocké ni renvoyé par le backend.
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

  async function handleReset() {
    if (!adminKey || saving) return;
    if (
      !window.confirm(
        `Réinitialiser le mot de passe du compte owner de « ${tenantName} » ? L'ancien mot de passe cessera immédiatement de fonctionner.`
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const password = generatePassword();
      await setTenantOwnerPassword(adminKey, tenantId, password);
      setNewPassword(password);
      showToast("Mot de passe du owner réinitialisé.", "success");
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Impossible de réinitialiser le mot de passe.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleReset}
        disabled={saving}
        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
      >
        {saving ? "Réinitialisation..." : "Réinitialiser le mot de passe du owner"}
      </button>
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
