"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, listFabrics, type Fabric } from "@/lib/api";
import { CatalogGate } from "@/components/CatalogGate";
import { NewFabricForm } from "@/components/NewFabricForm";
import { FabricsGallery } from "@/components/FabricsGallery";
import { LoadingBlock } from "@/components/Spinner";

function TissusPageContent() {
  const { apiKey } = useAuth();
  const { showToast } = useToast();
  const [fabrics, setFabrics] = useState<Fabric[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [settledToken, setSettledToken] = useState(-1);
  const loading = settledToken !== reloadToken;

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    listFabrics(apiKey)
      .then((data) => {
        if (cancelled) return;
        setFabrics(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger la liste des tissus."
        );
      })
      .finally(() => {
        if (!cancelled) setSettledToken(reloadToken);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, reloadToken]);

  function reload() {
    setReloadToken((t) => t + 1);
  }

  function handleCreated(fabric: Fabric) {
    setFabrics((prev) => (prev ? [fabric, ...prev] : [fabric]));
    showToast("Tissu créé avec succès.");
  }

  function handleUpdated(fabric: Fabric) {
    setFabrics((prev) =>
      prev ? prev.map((f) => (f.id === fabric.id ? fabric : f)) : prev
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tissus</h1>
          <p className="text-sm text-slate-500">
            Gérez le catalogue de tissus proposés pour vos commandes
            sur-mesure.
          </p>
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
        >
          {loading ? "Actualisation..." : "Actualiser"}
        </button>
      </div>

      <NewFabricForm onCreated={handleCreated} />

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && fabrics === null ? (
        <LoadingBlock label="Chargement des tissus..." />
      ) : (
        <FabricsGallery fabrics={fabrics ?? []} onUpdated={handleUpdated} />
      )}
    </div>
  );
}

export default function TissusPage() {
  return (
    <CatalogGate feature="fabrics_enabled">
      <TissusPageContent />
    </CatalogGate>
  );
}
