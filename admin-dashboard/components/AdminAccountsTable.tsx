"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, setAdminAccountActive, type AdminAccount } from "@/lib/api";
import { StatusBadge } from "./StatusBadge";

/**
 * Tableau des comptes super-admin ABMCY existants, avec un bouton pour
 * activer/désactiver chacun. Même pattern que TenantActiveToggle : le
 * bouton bascule directement le statut déjà vérifié par
 * authSvc.LoginSuperAdmin (WHERE ... AND is_active) côté backend.
 */
export function AdminAccountsTable({
  accounts,
  currentUserEmail,
  onActiveSaved,
}: {
  accounts: AdminAccount[];
  currentUserEmail: string | null;
  onActiveSaved: (userId: string, isActive: boolean) => void;
}) {
  const { adminKey } = useAuth();
  const { showToast } = useToast();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(account: AdminAccount) {
    if (!adminKey || savingId) return;
    const next = !account.is_active;
    if (
      !next &&
      !window.confirm(
        `Désactiver le compte ${account.email} ? Il ne pourra plus se connecter au dashboard admin.`
      )
    ) {
      return;
    }
    setSavingId(account.id);
    setError(null);
    try {
      await setAdminAccountActive(adminKey, account.id, next);
      onActiveSaved(account.id, next);
      showToast(next ? "Compte réactivé." : "Compte désactivé.", "success");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Impossible de mettre à jour ce compte.";
      setError(message);
      showToast(message, "error");
    } finally {
      setSavingId(null);
    }
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        Aucun compte pour le moment. Créez-en un avec le formulaire ci-dessus.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.map((a) => {
              const isSelf =
                currentUserEmail !== null &&
                a.email.toLowerCase() === currentUserEmail.toLowerCase();
              return (
                <tr key={a.id} className="align-middle hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {a.email}
                    {isSelf && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        vous
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge active={a.is_active} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleToggle(a)}
                      disabled={savingId === a.id || isSelf}
                      title={
                        isSelf
                          ? "Vous ne pouvez pas désactiver votre propre compte depuis ici."
                          : a.is_active
                            ? "Désactiver ce compte"
                            : "Réactiver ce compte"
                      }
                      className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingId === a.id
                        ? "..."
                        : a.is_active
                          ? "Désactiver"
                          : "Réactiver"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
