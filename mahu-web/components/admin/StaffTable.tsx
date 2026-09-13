"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { setStaffActive, type StaffUser } from "@/lib/admin-api";

export default function StaffTable({
  staff,
  onChanged,
}: {
  staff: StaffUser[];
  onChanged: (updated: StaffUser) => void;
}) {
  const { token } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleActive(member: StaffUser) {
    if (!token) return;
    setError(null);
    setBusyId(member.id);
    try {
      await setStaffActive(token, member.id, !member.is_active);
      onChanged({ ...member, is_active: !member.is_active });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action impossible.");
    } finally {
      setBusyId(null);
    }
  }

  if (staff.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        Aucun autre membre de l&apos;équipe pour l&apos;instant.
      </p>
    );
  }

  return (
    <div>
      {error ? (
        <p className="mb-3 text-sm text-[var(--accent-red)]">{error}</p>
      ) : null}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
            <th className="py-2 pr-4">Email</th>
            <th className="py-2 pr-4">Rôle</th>
            <th className="py-2 pr-4">Statut</th>
            <th className="py-2 pr-4" />
          </tr>
        </thead>
        <tbody>
          {staff.map((member) => (
            <tr
              key={member.id}
              className="border-b border-[var(--border-color)] text-[var(--text-main)]"
            >
              <td className="py-3 pr-4">{member.email}</td>
              <td className="py-3 pr-4">
                {member.role === "owner" ? "Owner" : "Staff"}
              </td>
              <td className="py-3 pr-4">
                {member.is_active ? "Actif" : "Désactivé"}
              </td>
              <td className="py-3 pr-4">
                <button
                  onClick={() => toggleActive(member)}
                  disabled={busyId === member.id}
                  className="text-xs font-semibold text-[var(--accent-red)] disabled:opacity-50"
                >
                  {member.is_active ? "Désactiver" : "Activer"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
