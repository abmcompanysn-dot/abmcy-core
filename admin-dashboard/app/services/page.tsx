"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError, getConfigStatus, type ConfigKey, type ConfigStatus } from "@/lib/api";
import { ConfigKeyField } from "@/components/ConfigKeyField";

interface ServiceGroup {
  title: string;
  description: string;
  keys: { key: ConfigKey; label: string; secret: boolean }[];
}

const SERVICE_GROUPS: ServiceGroup[] = [
  {
    title: "Cloudflare R2",
    description: "Stockage objet utilisé pour les fichiers des boutiques.",
    keys: [
      { key: "R2_ACCOUNT_ID", label: "Account ID", secret: false },
      { key: "R2_ACCESS_KEY_ID", label: "Access Key ID", secret: true },
      { key: "R2_SECRET_ACCESS_KEY", label: "Secret Access Key", secret: true },
      { key: "R2_BUCKET", label: "Bucket", secret: false },
      { key: "R2_PUBLIC_URL", label: "URL publique", secret: false },
    ],
  },
  {
    title: "Resend",
    description: "Envoi des emails transactionnels.",
    keys: [
      { key: "RESEND_API_KEY", label: "API Key", secret: true },
      { key: "RESEND_FROM_ADDR", label: "Adresse d'expédition", secret: false },
    ],
  },
  {
    title: "CinetPay",
    description: "Paiements en ligne.",
    keys: [
      { key: "CINETPAY_API_KEY", label: "API Key", secret: true },
      { key: "CINETPAY_SITE_ID", label: "Site ID", secret: false },
    ],
  },
];

export default function ServicesPage() {
  const { adminKey } = useAuth();
  const [statuses, setStatuses] = useState<ConfigStatus[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chargement initial au montage (et si la clé admin change).
  useEffect(() => {
    if (!adminKey) return;
    let ignore = false;

    (async () => {
      try {
        const data = await getConfigStatus(adminKey);
        if (ignore) return;
        setStatuses(data);
        setError(null);
      } catch (err) {
        if (ignore) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger la configuration des services."
        );
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [adminKey]);

  // Rechargement manuel (bouton "Actualiser" ou après enregistrement d'une clé).
  const load = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const data = await getConfigStatus(adminKey);
      setStatuses(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de charger la configuration des services."
      );
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  function statusFor(key: ConfigKey): ConfigStatus {
    return (
      statuses?.find((s) => s.key === key) ?? { key, configured: false }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Configuration des services
          </h1>
          <p className="text-sm text-slate-500">
            Clés et identifiants utilisés par la plateforme ABMCY.
          </p>
        </div>
        <button
          onClick={load}
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

      {loading && statuses === null ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Chargement de la configuration...
        </div>
      ) : (
        <div className="space-y-6">
          {SERVICE_GROUPS.map((group) => (
            <div
              key={group.title}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <h2 className="text-base font-semibold text-slate-900">
                {group.title}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {group.description}
              </p>
              <div className="mt-4 space-y-4">
                {group.keys.map(({ key, label, secret }) => (
                  <ConfigKeyField
                    key={key}
                    label={label}
                    secret={secret}
                    status={statusFor(key)}
                    onSaved={load}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
