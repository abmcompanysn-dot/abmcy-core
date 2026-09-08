"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, updateTenantRateLimit } from "@/lib/api";

/**
 * Édition en ligne des limites de trafic (requêtes/s + burst) d'un tenant,
 * utilisée dans le tableau des tenants.
 */
export function RateLimitEditor({
  tenantId,
  perSec,
  burst,
  onSaved,
}: {
  tenantId: string;
  perSec: number;
  burst: number;
  onSaved: (perSec: number, burst: number) => void;
}) {
  const { adminKey } = useAuth();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [perSecValue, setPerSecValue] = useState(String(perSec));
  const [burstValue, setBurstValue] = useState(String(burst));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setPerSecValue(String(perSec));
    setBurstValue(String(burst));
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    if (!adminKey) return;
    const nextPerSec = Number(perSecValue);
    const nextBurst = Number(burstValue);

    if (
      !Number.isFinite(nextPerSec) ||
      !Number.isFinite(nextBurst) ||
      nextPerSec <= 0 ||
      nextBurst <= 0
    ) {
      setError("Les valeurs doivent être des nombres strictement positifs.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateTenantRateLimit(adminKey, tenantId, {
        rate_limit_per_sec: nextPerSec,
        rate_limit_burst: nextBurst,
      });
      onSaved(nextPerSec, nextBurst);
      setEditing(false);
      showToast("Limites de trafic mises à jour.", "success");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Impossible de mettre à jour les limites de trafic.";
      setError(message);
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={startEditing}
        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
        title="Modifier les limites de trafic"
      >
        {perSec} req/s · burst {burst}
      </button>
    );
  }

  return (
    <div className="min-w-[220px] space-y-1.5">
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={1}
          value={perSecValue}
          onChange={(e) => setPerSecValue(e.target.value)}
          disabled={saving}
          className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          aria-label="Limite de requêtes par seconde"
        />
        <span className="text-xs text-slate-400">req/s</span>
        <input
          type="number"
          min={1}
          value={burstValue}
          onChange={(e) => setBurstValue(e.target.value)}
          disabled={saving}
          className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          aria-label="Burst"
        />
        <span className="text-xs text-slate-400">burst</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
        <button
          onClick={() => setEditing(false)}
          disabled={saving}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
