"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError, decodeStaffRole, listStaff, type StaffUser } from "@/lib/api";
import { NewStaffForm } from "@/components/NewStaffForm";
import { StaffTable } from "@/components/StaffTable";
import { LoadingBlock } from "@/components/Spinner";

/**
 * Gestion d'équipe — réservée aux connexions par compte personnel (JWT
 * staff), pas à la clé API technique : GET/POST /staff exigent
 * requireStaffJWT côté backend (une intégration X-API-Key n'a pas
 * d'identité humaine). Voir app/layout.tsx / NavBar.tsx pour le lien,
 * conditionné à isStaffSession.
 */
function EquipePageContent() {
  const { apiKey } = useAuth();
  const [staff, setStaff] = useState<StaffUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [settledToken, setSettledToken] = useState(-1);
  const loading = settledToken !== reloadToken;

  const role = apiKey ? decodeStaffRole(apiKey) : null;
  const canManage = role === "owner";

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    listStaff(apiKey)
      .then((data) => {
        if (cancelled) return;
        setStaff(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger l'équipe."
        );
      })
      .finally(() => {
        if (!cancelled) setSettledToken(reloadToken);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, reloadToken]);

  function reload() {
    setReloadToken((t) => t + 1);
  }

  function handleCreated(member: StaffUser) {
    setStaff((prev) => (prev ? [...prev, member] : [member]));
  }

  function handleUpdated(member: StaffUser) {
    setStaff((prev) =>
      prev ? prev.map((s) => (s.id === member.id ? member : s)) : prev
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Équipe</h1>
          <p className="text-sm text-slate-500">
            Gérez les comptes personnels de votre équipe (connexion
            email/mot de passe, distincte de la clé API technique).
          </p>
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
        >
          {loading ? "Actualisation..." : "Actualiser"}
        </button>
      </div>

      {canManage ? (
        <NewStaffForm onCreated={handleCreated} />
      ) : (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-500">
          Seul le propriétaire du compte peut ajouter ou désactiver des
          membres de l&apos;équipe.
        </p>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && staff === null ? (
        <LoadingBlock label="Chargement de l'équipe..." />
      ) : (
        <StaffTable
          staff={staff ?? []}
          canManage={canManage}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}

export default function EquipePage() {
  const { isStaffSession } = useAuth();

  if (!isStaffSession) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-10 text-center">
        <h1 className="text-lg font-semibold text-amber-900">
          Connexion personnelle requise
        </h1>
        <p className="mt-2 text-sm text-amber-700">
          La gestion d&apos;équipe nécessite une connexion avec un compte
          personnel (identifiant boutique + email + mot de passe), pas la
          clé API technique. Déconnectez-vous puis reconnectez-vous avec
          vos identifiants personnels.
        </p>
      </div>
    );
  }

  return <EquipePageContent />;
}
