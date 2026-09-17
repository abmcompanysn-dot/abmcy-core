"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, setStaffActive, type StaffUser } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  staff: "Staff",
};

/** Version mobile de StaffTable : une carte par membre d'équipe. */
export function StaffCardList({
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
      {staff.map((member) => (
        <div
          key={member.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">
              {member.email}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-slate-500">
                {ROLE_LABELS[member.role] ?? member.role}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  member.is_active
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {member.is_active ? "Actif" : "Désactivé"}
              </span>
            </div>
          </div>
          {canManage && (
            <button
              onClick={() => handleToggleActive(member)}
              disabled={pendingId === member.id}
              className="shrink-0 text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50"
            >
              {pendingId === member.id
                ? "..."
                : member.is_active
                  ? "Désactiver"
                  : "Réactiver"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
