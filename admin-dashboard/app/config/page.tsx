"use client";

import { useEffect, useState } from "react";
import { API_URL, checkHealth } from "@/lib/api";

export default function ConfigPage() {
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    checkHealth().then((ok) => {
      if (!cancelled) {
        setHealthy(ok);
        setChecking(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Configuration
        </h1>
        <p className="text-sm text-slate-500">
          Paramètres de connexion à l&apos;API backend ABMCY.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">
          URL de l&apos;API backend
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Définie via la variable d&apos;environnement{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
            NEXT_PUBLIC_API_URL
          </code>
          . À défaut, la valeur par défaut suivante est utilisée :{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
            https://api.abmcy.com
          </code>
          .
        </p>

        <div className="mt-4 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="font-mono text-sm text-slate-900">{API_URL}</span>
          <span className="flex items-center gap-2 text-sm">
            {checking ? (
              <span className="text-slate-400">Vérification...</span>
            ) : healthy ? (
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                API accessible
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-red-600">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                API injoignable
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">
          Comment changer l&apos;URL de l&apos;API
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>
            En local : ajoutez{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
              NEXT_PUBLIC_API_URL=https://votre-api.example.com
            </code>{" "}
            dans un fichier <code className="text-xs">.env.local</code>.
          </li>
          <li>
            Sur Vercel : renseignez la variable{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
              NEXT_PUBLIC_API_URL
            </code>{" "}
            dans les paramètres du projet (Environment Variables), puis
            redéployez.
          </li>
        </ul>
      </div>
    </div>
  );
}
