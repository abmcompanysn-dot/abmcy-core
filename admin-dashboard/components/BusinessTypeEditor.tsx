"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  ApiError,
  updateTenantBusinessType,
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABELS,
  type BusinessType,
} from "@/lib/api";

/**
 * Édition en ligne du type de commerce d'un tenant, utilisée dans le
 * tableau des tenants.
 */
export function BusinessTypeEditor({
  tenantId,
  businessType,
  onSaved,
}: {
  tenantId: string;
  businessType: BusinessType;
  onSaved: (businessType: BusinessType) => void;
}) {
  const { adminKey } = useAuth();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<BusinessType>(businessType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setValue(businessType);
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    if (!adminKey) return;
    setSaving(true);
    setError(null);
    try {
      await updateTenantBusinessType(adminKey, tenantId, value);
      onSaved(value);
      setEditing(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de mettre à jour le type de commerce."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={startEditing}
        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
        title="Modifier le type de commerce"
      >
        {BUSINESS_TYPE_LABELS[businessType]}
      </button>
    );
  }

  return (
    <div className="min-w-[220px] space-y-1.5">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value as BusinessType)}
        disabled={saving}
        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        aria-label="Type de commerce"
      >
        {BUSINESS_TYPES.map((bt) => (
          <option key={bt} value={bt}>
            {BUSINESS_TYPE_LABELS[bt]}
          </option>
        ))}
      </select>
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
