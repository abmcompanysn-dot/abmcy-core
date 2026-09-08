"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError, listAdminAccounts, type AdminAccount } from "@/lib/api";
import { CreateAdminAccountForm } from "@/components/CreateAdminAccountForm";
import { AdminAccountsTable } from "@/components/AdminAccountsTable";
import { LoadingBlock } from "@/components/Spinner";

export default function AdminAccountsPage() {
  const { adminKey, adminEmail } = useAuth();
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chargement initial au montage (et si la clé admin change) — même
  // pattern que app/page.tsx (IIFE async dans l'effet + garde d'annulation).
  useEffect(() => {
    if (!adminKey) return;
    let ignore = false;

    (async () => {
      try {
        const data = await listAdminAccounts(adminKey);
        if (ignore) return;
        setAccounts(data);
        setError(null);
      } catch (err) {
        if (ignore) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger les comptes admin."
        );
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [adminKey]);

  const reload = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const data = await listAdminAccounts(adminKey);
      setAccounts(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de charger les comptes admin."
      );
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  function handleCreated(account: AdminAccount) {
    setAccounts((prev) => (prev ? [...prev, account] : [account]));
  }

  function handleActiveSaved(userId: string, isActive: boolean) {
    setAccounts((prev) =>
      prev ? prev.map((a) => (a.id === userId ? { ...a, is_active: isActive } : a)) : prev
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Comptes admin
          </h1>
          <p className="text-sm text-slate-500">
            Comptes ABMCY ayant accès à ce dashboard (email + mot de passe),
            en plus de la clé X-Admin-Key.
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

      <CreateAdminAccountForm onCreated={handleCreated} />

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && accounts === null ? (
        <LoadingBlock label="Chargement des comptes..." />
      ) : (
        <AdminAccountsTable
          accounts={accounts ?? []}
          currentUserEmail={adminEmail}
          onActiveSaved={handleActiveSaved}
        />
      )}
    </div>
  );
}
