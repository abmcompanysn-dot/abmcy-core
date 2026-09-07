"use client";

import { useState } from "react";

export function NewSecretModal({
  tenantName,
  secret,
  onClose,
}: {
  tenantName: string;
  secret: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Le presse-papiers peut être indisponible ; l'utilisateur peut
      // toujours sélectionner le texte manuellement.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            !
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Tenant « {tenantName} » créé
            </h2>
            <p className="mt-1 text-sm text-red-600">
              Copiez cette clé maintenant, elle ne sera plus jamais affichée.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Clé API secrète (api_key_secret)
          </label>
          <div className="flex items-stretch gap-2">
            <input
              readOnly
              value={secret}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 outline-none"
            />
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              {copied ? "Copié !" : "Copier"}
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            J&apos;ai copié la clé, fermer
          </button>
        </div>
      </div>
    </div>
  );
}
