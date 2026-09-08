"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, setStaffActive, type StaffUser } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  staff: "Staff",
};

/** Table des membres de l'équipe — activer/désactiver réservé au rôle
 * owner (voir handleSetStaffActive côté backend, même contrôle). */
export function StaffTable({
  staff,
  canManage,
  onUpdated,
}: {
  staff: StaffUser[];
  canManage: boolean;
  onUpdated: (staff: StaffUser) => void;
}) {
  const { apiKey } = useAuth();
  const { showToast } = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggleActive(member: StaffUser) {
    if (!apiKey) return;
    setError(null);
    setPendingId(member.id);
    try {
      await setStaffActive(apiKey, member.id, !member.is_active);
      onUpdated({ ...member, is_active: !member.is_active });
      showToast(
        !member.is_active
          ? `${member.email} a été réactivé(e).`
          : `${member.email} a été désactivé(e).`
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de modifier ce membre de l'équipe."
      );
    } finally {
      setPendingId(null);
    }
  }

  if (staff.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Aucun membre d&apos;équipe pour le moment.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Rôle</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              {canManage && (
                <th className="px-4 py-3 font-medium text-right">Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr
                key={member.id}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                <td className="px-4 py-3 text-slate-900">{member.email}</td>
                <td className="px-4 py-3 text-slate-600">
                  {ROLE_LABELS[member.role] ?? member.role}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      member.is_active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {member.is_active ? "Actif" : "Désactivé"}
                  </span>
                </td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleToggleActive(member)}
                      disabled={pendingId === member.id}
                      className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50"
                    >
                      {pendingId === member.id
                        ? "..."
                        : member.is_active
                          ? "Désactiver"
                          : "Réactiver"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
