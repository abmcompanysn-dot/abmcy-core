"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  ApiError,
  createTenant,
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABELS,
  type BusinessType,
  type Tenant,
} from "@/lib/api";
import { NewSecretModal } from "./NewSecretModal";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function CreateTenantForm({
  onCreated,
}: {
  onCreated: (tenant: Tenant) => void;
}) {
  const { adminKey } = useAuth();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [businessType, setBusinessType] = useState<BusinessType>("general");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<{
    tenantName: string;
    secret: string;
  } | null>(null);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!adminKey) return;
    setError(null);

    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();
    if (!trimmedName || !trimmedSlug) {
      setError("Le nom et le slug sont requis.");
      return;
    }

    setLoading(true);
    try {
      const result = await createTenant(adminKey, {
        name: trimmedName,
        slug: trimmedSlug,
        business_type: businessType,
      });
      onCreated(result.tenant);
      setNewSecret({ tenantName: result.tenant.name, secret: result.api_key_secret });
      setName("");
      setSlug("");
      setSlugTouched(false);
      setBusinessType("general");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Une erreur inconnue est survenue lors de la création.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 bg-white p-5"
      >
        <h2 className="text-base font-semibold text-slate-900">
          Créer un nouveau tenant
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <div>
            <label
              htmlFor="tenant-name"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Nom
            </label>
            <input
              id="tenant-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ex. Boutique Awa"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>
          <div>
            <label
              htmlFor="tenant-slug"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Slug
            </label>
            <input
              id="tenant-slug"
              value={slug}
              onChange={(e) => {
                setSlug(slugify(e.target.value));
                setSlugTouched(true);
              }}
              placeholder="Ex. boutique-awa"
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>
          <div>
            <label
              htmlFor="tenant-business-type"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Type de commerce
            </label>
            <select
              id="tenant-business-type"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value as BusinessType)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
            >
              {BUSINESS_TYPES.map((bt) => (
                <option key={bt} value={bt}>
                  {BUSINESS_TYPE_LABELS[bt]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={loading || !name.trim() || !slug.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Création..." : "Créer le tenant"}
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>

      {newSecret && (
        <NewSecretModal
          tenantName={newSecret.tenantName}
          secret={newSecret.secret}
          onClose={() => setNewSecret(null)}
        />
      )}
    </>
  );
}
