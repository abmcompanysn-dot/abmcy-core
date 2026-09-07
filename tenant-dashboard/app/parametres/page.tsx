"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { API_URL, checkHealth } from "@/lib/api";

type HealthState = "idle" | "checking" | "ok" | "down";

export default function SettingsPage() {
  const { logout } = useAuth();
  const [health, setHealth] = useState<HealthState>("idle");

  async function testHealth() {
    setHealth("checking");
    const ok = await checkHealth();
    setHealth(ok ? "ok" : "down");
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="text-sm text-slate-500">
          Informations de connexion à l&apos;API et gestion de la session.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-sm font-medium text-slate-700">
            URL de l&apos;API
          </h2>
          <p className="mt-1 font-mono text-sm text-slate-900">{API_URL}</p>
          <p className="mt-1 text-xs text-slate-400">
            Configurée via la variable d&apos;environnement
            NEXT_PUBLIC_API_URL (repli : https://api.abmcy.com).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={testHealth}
            disabled={health === "checking"}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            {health === "checking" ? "Vérification..." : "Tester la disponibilité"}
          </button>

          {health === "ok" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              API disponible
            </span>
          )}
          {health === "down" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              API indisponible
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium text-slate-700">Session</h2>
        <p className="mt-1 text-xs text-slate-400">
          Votre clé API est stockée uniquement dans le navigateur. Se
          déconnecter l&apos;efface du localStorage.
        </p>
        <button
          onClick={logout}
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
