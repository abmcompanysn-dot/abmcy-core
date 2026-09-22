"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import {
  ApiError,
  listTenantDomains,
  purchaseDomain,
  registerExistingDomain,
  searchDomains,
  type DomainSearchResult,
  type TenantDomain,
} from "@/lib/api";
import { formatFCFA } from "@/lib/format";

const STATUS_LABELS: Record<TenantDomain["status"], string> = {
  pending: "En attente de paiement",
  active: "Actif",
  failed: "Échec",
};

const STATUS_STYLES: Record<TenantDomain["status"], string> = {
  pending: "bg-amber-50 text-amber-700",
  active: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
};

/** Nom de domaine : renseigner un domaine déjà possédé, ou rechercher et
 * acheter un nouveau domaine (ABMCY l'achète via Porkbun et facture le
 * tenant avec une marge — voir internal/domain côté backend). */
export function DomainSection() {
  const { apiKey } = useAuth();
  const { showToast } = useToast();
  const [domains, setDomains] = useState<TenantDomain[]>([]);
  const [existingInput, setExistingInput] = useState("");
  const [savingExisting, setSavingExisting] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [results, setResults] = useState<DomainSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    listTenantDomains(apiKey)
      .then((d) => {
        if (!cancelled) setDomains(d);
      })
      .catch(() => {
        // Silencieux : historique vide ou service pas encore configuré.
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  async function handleRegisterExisting() {
    if (!apiKey || !existingInput.trim() || savingExisting) return;
    setSavingExisting(true);
    try {
      const d = await registerExistingDomain(apiKey, existingInput.trim());
      setDomains((prev) => [d, ...prev]);
      setExistingInput("");
      showToast("Domaine enregistré.", "success");
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Impossible d'enregistrer ce domaine.",
        "error"
      );
    } finally {
      setSavingExisting(false);
    }
  }

  async function handleSearch() {
    if (!apiKey || !searchInput.trim() || searching) return;
    setSearching(true);
    setResults(null);
    try {
      const r = await searchDomains(apiKey, searchInput.trim());
      setResults(r);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Recherche de domaine indisponible.",
        "error"
      );
    } finally {
      setSearching(false);
    }
  }

  async function handlePurchase(domainName: string) {
    if (!apiKey || purchasing) return;
    setPurchasing(domainName);
    try {
      const d = await purchaseDomain(apiKey, domainName, window.location.href);
      setDomains((prev) => [d, ...prev]);
      if (d.payment_url) {
        window.location.assign(d.payment_url);
      }
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Impossible de lancer l'achat.",
        "error"
      );
    } finally {
      setPurchasing(null);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium text-slate-700">Nom de domaine</h2>

      <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          J&apos;ai déjà un domaine
        </h3>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={existingInput}
            onChange={(e) => setExistingInput(e.target.value)}
            placeholder="ex : ma-boutique.com"
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={handleRegisterExisting}
            disabled={savingExisting || !existingInput.trim()}
            className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            {savingExisting ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Acheter un nouveau domaine
        </h3>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="ex : ma-boutique"
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !searchInput.trim()}
            className="shrink-0 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {searching ? "Recherche..." : "Rechercher"}
          </button>
        </div>

        {results && (
          <div className="mt-3 space-y-1.5">
            {results.map((r) => (
              <div
                key={r.domain}
                className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm"
              >
                <span className="text-slate-900">{r.domain}</span>
                {r.available ? (
                  <div className="flex items-center gap-2">
                    {r.price_fcfa != null && (
                      <span className="text-slate-600">{formatFCFA(r.price_fcfa)}/an</span>
                    )}
                    <button
                      onClick={() => handlePurchase(r.domain)}
                      disabled={purchasing === r.domain}
                      className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50"
                    >
                      {purchasing === r.domain ? "..." : "Acheter"}
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">Indisponible</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {domains.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Mes domaines
          </h3>
          <div className="space-y-1.5">
            {domains.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-900">{d.domain}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[d.status]}`}
                >
                  {STATUS_LABELS[d.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
