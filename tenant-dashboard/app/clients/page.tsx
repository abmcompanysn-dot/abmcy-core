"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError, listCustomers, type Customer } from "@/lib/api";
import { CustomerTable } from "@/components/CustomerTable";
import { LoadingBlock } from "@/components/Spinner";

/**
 * Clients finaux (ex: Fatou) — toujours accessible, pas de feature flag
 * (contrairement au catalogue) : un tenant qui a des clients doit pouvoir
 * consulter/corriger leur dossier quel que soit le service catalogue
 * actif. Réservée aux connexions par compte personnel (JWT staff) comme
 * la gestion d'équipe — GET/PATCH /customers exigent requireStaffJWT côté
 * backend, une clé API technique n'a pas d'identité humaine à qui imputer
 * une modification.
 */
function ClientsPageContent() {
  const { apiKey } = useAuth();
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [settledToken, setSettledToken] = useState(-1);
  const loading = settledToken !== reloadToken;

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    listCustomers(apiKey)
      .then((data) => {
        if (cancelled) return;
        setCustomers(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger la liste des clients."
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

  function handleUpdated(updated: Customer) {
    setCustomers((prev) =>
      prev ? prev.map((c) => (c.id === updated.id ? updated : c)) : prev
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500">
            Consultez et corrigez les coordonnées de vos clients, ou
            définissez leur mot de passe de suivi de commande.
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

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && customers === null ? (
        <LoadingBlock label="Chargement des clients..." />
      ) : (
        <CustomerTable customers={customers ?? []} onUpdated={handleUpdated} />
      )}
    </div>
  );
}

export default function ClientsPage() {
  const { isStaffSession } = useAuth();

  if (!isStaffSession) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-10 text-center">
        <h1 className="text-lg font-semibold text-amber-900">
          Connexion personnelle requise
        </h1>
        <p className="mt-2 text-sm text-amber-700">
          La gestion des clients nécessite une connexion avec un compte
          personnel (identifiant boutique + email + mot de passe), pas la
          clé API technique. Déconnectez-vous puis reconnectez-vous avec
          vos identifiants personnels.
        </p>
      </div>
    );
  }

  return <ClientsPageContent />;
}
