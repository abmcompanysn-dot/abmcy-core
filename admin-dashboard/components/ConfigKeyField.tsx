"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError, setConfigValue, type ConfigKey, type ConfigStatus } from "@/lib/api";

/** Un champ de saisie pour une clé de configuration plateforme donnée. */
export function ConfigKeyField({
  label,
  status,
  secret,
  onSaved,
}: {
  label: string;
  status: ConfigStatus;
  secret: boolean;
  onSaved: () => void;
}) {
  const { adminKey } = useAuth();
  const [value, setValue] = useState(status.value ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!adminKey) return;
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Veuillez saisir une valeur.");
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await setConfigValue(adminKey, status.key as ConfigKey, trimmed);
      setSaved(true);
      if (secret) setValue("");
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible d'enregistrer cette valeur."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-3 sm:grid-cols-[minmax(0,220px)_1fr_auto] sm:items-end"
    >
      <div>
        <label
          htmlFor={`config-${status.key}`}
          className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700"
        >
          {label}
          {status.configured ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Configurée ✓
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              Non configurée
            </span>
          )}
        </label>
        <code className="text-xs text-slate-400">{status.key}</code>
      </div>
      <input
        id={`config-${status.key}`}
        type={secret ? "password" : "text"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={
          secret
            ? status.configured
              ? "•••••••• (laisser vide pour ne pas changer)"
              : "Saisir la valeur secrète"
            : "Saisir la valeur"
        }
        disabled={saving}
        className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={saving || !value.trim()}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Enregistrement..." : saved ? "Enregistré ✓" : "Enregistrer"}
      </button>
      {error && (
        <p className="sm:col-span-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
