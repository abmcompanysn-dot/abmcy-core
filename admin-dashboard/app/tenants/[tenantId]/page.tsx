"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import {
  ApiError,
  listTenants,
  listTenantSocials,
  setTenantSocials,
  updateTenantProfile,
  uploadTenantLogo,
  type Tenant,
} from "@/lib/api";
import { LoadingBlock } from "@/components/Spinner";

const SOCIAL_TYPES = [
  "instagram",
  "tiktok",
  "snapchat",
  "whatsapp",
  "website",
  "facebook",
  "youtube",
] as const;

type SocialDraft = { type: string; url: string };

function emptyProfileForm() {
  return {
    contact_email: "",
    contact_name: "",
    contact_phone: "",
    contact_role: "",
    logo_url: "",
    brand_color: "",
    tagline: "",
    language: "fr",
  };
}

export default function TenantProfilePage() {
  const { adminKey } = useAuth();
  const { showToast } = useToast();
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [form, setForm] = useState(emptyProfileForm());
  const [socials, setSocials] = useState<SocialDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSocials, setSavingSocials] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Chargement initial au montage (et si la clé admin ou le tenant
  // changent) : la récupération est faite directement dans l'effet (IIFE
  // async), avec un indicateur d'annulation pour éviter toute mise à jour
  // sur un composant démonté ou obsolète — même pattern que app/page.tsx.
  useEffect(() => {
    if (!adminKey || !tenantId) return;
    let ignore = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [tenants, socialList] = await Promise.all([
          listTenants(adminKey),
          listTenantSocials(adminKey, tenantId),
        ]);
        if (ignore) return;
        const found = tenants.find((t) => t.id === tenantId) ?? null;
        setTenant(found);
        if (found) {
          setForm({
            contact_email: found.contact_email ?? "",
            contact_name: found.contact_name ?? "",
            contact_phone: found.contact_phone ?? "",
            contact_role: found.contact_role ?? "",
            logo_url: found.logo_url ?? "",
            brand_color: found.brand_color ?? "",
            tagline: found.tagline ?? "",
            language: found.language || "fr",
          });
        }
        setSocials(socialList.map((s) => ({ type: s.type, url: s.url })));
      } catch (err) {
        if (ignore) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger le profil de ce tenant."
        );
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [adminKey, tenantId]);

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    if (!adminKey || !tenantId) return;
    setSavingProfile(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateTenantProfile(adminKey, tenantId, {
        contact_email: form.contact_email || undefined,
        contact_name: form.contact_name || undefined,
        contact_phone: form.contact_phone || undefined,
        contact_role: form.contact_role || undefined,
        logo_url: form.logo_url || undefined,
        brand_color: form.brand_color || undefined,
        tagline: form.tagline || undefined,
        language: form.language || undefined,
      });
      setTenant(updated);
      setMessage("Profil enregistré.");
      showToast("Profil enregistré.", "success");
    } catch (err) {
      const errMessage =
        err instanceof ApiError
          ? err.message
          : "Impossible d'enregistrer le profil.";
      setError(errMessage);
      showToast(errMessage, "error");
    } finally {
      setSavingProfile(false);
    }
  }

  /**
   * Upload direct du logo depuis ce formulaire : POST
   * /admin/tenants/{id}/logo (clé admin, pas besoin de la clé API du
   * tenant), puis on colle l'URL renvoyée dans le champ logo_url — il faut
   * encore cliquer sur "Enregistrer le profil" pour l'attacher réellement
   * au tenant, exactement comme avant quand l'URL était collée à la main.
   */
  async function handleLogoFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de re-sélectionner le même fichier plus tard
    if (!file || !adminKey || !tenantId) return;

    setUploadingLogo(true);
    setError(null);
    try {
      const uploaded = await uploadTenantLogo(adminKey, tenantId, file);
      setForm((f) => ({ ...f, logo_url: uploaded.url }));
      showToast(
        "Logo envoyé — cliquez sur « Enregistrer le profil » pour l'appliquer.",
        "success"
      );
    } catch (err) {
      const errMessage =
        err instanceof ApiError ? err.message : "Impossible d'envoyer le logo.";
      setError(errMessage);
      showToast(errMessage, "error");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSocialsSubmit(e: FormEvent) {
    e.preventDefault();
    if (!adminKey || !tenantId) return;
    const cleaned = socials.filter((s) => s.type.trim() && s.url.trim());
    setSavingSocials(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await setTenantSocials(adminKey, tenantId, cleaned);
      setSocials(saved.map((s) => ({ type: s.type, url: s.url })));
      setMessage("Réseaux sociaux enregistrés.");
      showToast("Réseaux sociaux enregistrés.", "success");
    } catch (err) {
      const errMessage =
        err instanceof ApiError
          ? err.message
          : "Impossible d'enregistrer les réseaux sociaux.";
      setError(errMessage);
      showToast(errMessage, "error");
    } finally {
      setSavingSocials(false);
    }
  }

  function updateSocial(index: number, patch: Partial<SocialDraft>) {
    setSocials((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  }

  function removeSocial(index: number) {
    setSocials((prev) => prev.filter((_, i) => i !== index));
  }

  function addSocial() {
    setSocials((prev) => [...prev, { type: "instagram", url: "" }]);
  }

  if (loading && !tenant) {
    return <LoadingBlock label="Chargement du profil..." />;
  }

  if (!loading && !tenant) {
    return (
      <div className="space-y-4">
        <Link
          href="/"
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          ← Retour aux tenants
        </Link>
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Tenant introuvable.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/"
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          ← Retour aux tenants
        </Link>
        <div className="mt-2 flex items-center gap-3">
          {form.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.logo_url}
              alt=""
              className="h-12 w-12 rounded-lg border border-slate-200 object-cover"
            />
          )}
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Profil — {tenant?.name}
            </h1>
            <p className="text-sm text-slate-500">
              Identité publique du tenant : contact, logo, marque, réseaux
              sociaux.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      )}

      <form
        onSubmit={handleProfileSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
      >
        <h2 className="text-base font-semibold text-slate-900">
          Contact & marque
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Nom du contact
            </span>
            <input
              type="text"
              value={form.contact_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, contact_name: e.target.value }))
              }
              placeholder="ex : Hanifah Afsata Jahida KONE"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Rôle du contact
            </span>
            <input
              type="text"
              value={form.contact_role}
              onChange={(e) =>
                setForm((f) => ({ ...f, contact_role: e.target.value }))
              }
              placeholder="ex : PDG"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Téléphone
            </span>
            <input
              type="tel"
              value={form.contact_phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, contact_phone: e.target.value }))
              }
              placeholder="ex : 22675544742"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Email de contact
            </span>
            <input
              type="email"
              value={form.contact_email}
              onChange={(e) =>
                setForm((f) => ({ ...f, contact_email: e.target.value }))
              }
              placeholder="ex : contact@hanis.com"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">
              URL du logo
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="url"
                value={form.logo_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, logo_url: e.target.value }))
                }
                placeholder="https://abmcy.mahu.cards/..."
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
              <label
                className={`shrink-0 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 ${
                  uploadingLogo ? "cursor-wait opacity-50" : "cursor-pointer"
                }`}
              >
                {uploadingLogo ? "Envoi..." : "Choisir un fichier"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileChange}
                  disabled={uploadingLogo}
                  className="hidden"
                />
              </label>
            </div>
            <span className="mt-1 block text-xs text-slate-500">
              Uploadez directement un fichier (bouton ci-dessus) ou collez
              une URL déjà hébergée. L&apos;upload seul ne suffit pas :
              cliquez ensuite sur « Enregistrer le profil » pour
              l&apos;appliquer au tenant.
            </span>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Couleur de marque
            </span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.brand_color || "#4338ca"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, brand_color: e.target.value }))
                }
                className="h-9 w-12 cursor-pointer rounded border border-slate-300"
              />
              <input
                type="text"
                value={form.brand_color}
                onChange={(e) =>
                  setForm((f) => ({ ...f, brand_color: e.target.value }))
                }
                placeholder="#4da6ff"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Langue
            </span>
            <select
              value={form.language}
              onChange={(e) =>
                setForm((f) => ({ ...f, language: e.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="fr">Français</option>
              <option value="en">Anglais</option>
            </select>
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">
              Accroche (tagline)
            </span>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) =>
                setForm((f) => ({ ...f, tagline: e.target.value }))
              }
              placeholder="ex : Vêtements modestes"
              maxLength={200}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={savingProfile}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {savingProfile ? "Enregistrement..." : "Enregistrer le profil"}
        </button>
      </form>

      <form
        onSubmit={handleSocialsSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Réseaux sociaux & contact
          </h2>
          <button
            type="button"
            onClick={addSocial}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
          >
            + Ajouter un lien
          </button>
        </div>

        {socials.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucun lien pour l&apos;instant.
          </p>
        ) : (
          <div className="space-y-3">
            {socials.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  value={s.type}
                  onChange={(e) =>
                    updateSocial(i, { type: e.target.value })
                  }
                  className="rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  {SOCIAL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input
                  type="url"
                  value={s.url}
                  onChange={(e) => updateSocial(i, { url: e.target.value })}
                  placeholder="https://..."
                  className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeSocial(i)}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={savingSocials}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {savingSocials ? "Enregistrement..." : "Enregistrer les liens"}
        </button>
      </form>
    </div>
  );
}
