"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { decodeStaffRole, listStaff, type StaffUser } from "@/lib/admin-api";
import NewStaffForm from "@/components/admin/NewStaffForm";
import StaffTable from "@/components/admin/StaffTable";
import { LoadingBlock } from "@/components/Spinner";

/** Réservée au rôle owner — le lien "Équipe" n'est déjà affiché qu'aux
 * owners (app/admin/layout.tsx), mais la page se protège aussi
 * elle-même : accéder à l'URL directement ne doit pas suffire à
 * contourner la restriction d'affichage. Le backend revérifie de toute
 * façon le rôle sur POST /staff (handleCreateStaff), donc cette page
 * n'est qu'un confort d'UX, pas la couche de sécurité réelle. */
export default function EquipePage() {
  const { token } = useAuth();
  const [staff, setStaff] = useState<StaffUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);

  const role = token ? decodeStaffRole(token) : null;

  useEffect(() => {
    if (!token || role !== "owner") return;
    let cancelled = false;

    listStaff(token)
      .then((data) => {
        if (cancelled) return;
        setStaff(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError ? err.message : "Impossible de charger l'équipe."
        );
      })
      .finally(() => {
        if (!cancelled) setSettled(true);
      });

    return () => {
      cancelled = true;
    };
  }, [token, role]);

  if (role !== "owner") {
    return (
      <main className="mx-auto max-w-[800px] px-4 py-10 sm:px-8">
        <p className="text-sm text-[var(--text-muted)]">
          Cette page est réservée aux comptes owner.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[800px] px-4 py-10 sm:px-8">
      <h1 className="mb-6 font-[family-name:var(--font-display)] text-2xl text-[var(--text-main)]">
        Équipe
      </h1>

      <NewStaffForm
        onCreated={(created) =>
          setStaff((prev) => (prev ? [...prev, created] : [created]))
        }
      />

      {error ? (
        <div className="rounded border border-[var(--accent-red)]/40 bg-[var(--bg-card)] p-6 text-sm text-[var(--text-main)]">
          {error}
        </div>
      ) : !settled || !staff ? (
        <LoadingBlock label="Chargement de l'équipe..." />
      ) : (
        <StaffTable
          staff={staff}
          onChanged={(updated) =>
            setStaff((prev) =>
              prev
                ? prev.map((s) => (s.id === updated.id ? updated : s))
                : prev
            )
          }
        />
      )}
    </main>
  );
}
