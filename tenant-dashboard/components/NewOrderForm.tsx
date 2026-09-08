"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, createOrder, type Order } from "@/lib/api";

interface ExtraField {
  key: string;
  value: string;
}

const BASE_MEASUREMENTS = [
  { key: "poitrine", label: "Poitrine (cm)" },
  { key: "taille", label: "Taille (cm)" },
  { key: "hanches", label: "Hanches (cm)" },
  { key: "longueur", label: "Longueur (cm)" },
];

export function NewOrderForm({
  onCreated,
}: {
  onCreated: (order: Order) => void;
}) {
  const { apiKey } = useAuth();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [measurements, setMeasurements] = useState<Record<string, string>>(
    {}
  );
  const [extraFields, setExtraFields] = useState<ExtraField[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setTotalAmount("");
    setMeasurements({});
    setExtraFields([]);
    setError(null);
  }

  function addExtraField() {
    setExtraFields((prev) => [...prev, { key: "", value: "" }]);
  }

  function updateExtraField(index: number, patch: Partial<ExtraField>) {
    setExtraFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );
  }

  function removeExtraField(index: number) {
    setExtraFields((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!apiKey) return;
    setError(null);

    if (!customerName.trim() || !customerPhone.trim()) {
      setError("Le nom et le téléphone du client sont obligatoires.");
      return;
    }
    const amount = Number(totalAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Le montant doit être un nombre valide.");
      return;
    }

    const measurementsPayload: Record<string, unknown> = {};
    for (const { key, label } of BASE_MEASUREMENTS) {
      const raw = measurements[key];
      if (raw !== undefined && raw !== "") {
        const num = Number(raw);
        if (!Number.isFinite(num)) {
          setError(`${label} doit être un nombre.`);
          return;
        }
        measurementsPayload[key] = num;
      }
    }
    for (const { key, value } of extraFields) {
      const trimmedKey = key.trim();
      if (!trimmedKey) continue;
      const num = Number(value);
      measurementsPayload[trimmedKey] = value !== "" && Number.isFinite(num)
        ? num
        : value;
    }

    setLoading(true);
    try {
      const order = await createOrder(apiKey, {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim() || undefined,
        total_amount: Math.round(amount),
        measurements:
          Object.keys(measurementsPayload).length > 0
            ? measurementsPayload
            : undefined,
      });
      onCreated(order);
      showToast(`Commande ${order.order_number} créée avec succès.`);
      resetForm();
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de créer la commande."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
      >
        + Nouvelle commande
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          Nouvelle commande
        </h2>
        <button
          onClick={() => {
            setOpen(false);
            resetForm();
          }}
          className="text-sm text-slate-400 hover:text-slate-600"
        >
          Annuler
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Nom du client *
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Téléphone *
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Email (optionnel)
            </label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Montant (FCFA) *
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-700">
            Mesures sur-mesure (optionnel)
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {BASE_MEASUREMENTS.map(({ key, label }) => (
              <div key={key}>
                <label className="mb-1 block text-xs text-slate-500">
                  {label}
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={measurements[key] ?? ""}
                  onChange={(e) =>
                    setMeasurements((prev) => ({
                      ...prev,
                      [key]: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  disabled={loading}
                />
              </div>
            ))}
          </div>

          {extraFields.length > 0 && (
            <div className="mt-3 space-y-2">
              {extraFields.map((field, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Nom de la mesure"
                    value={field.key}
                    onChange={(e) =>
                      updateExtraField(index, { key: e.target.value })
                    }
                    className="w-1/2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    disabled={loading}
                  />
                  <input
                    type="text"
                    placeholder="Valeur"
                    value={field.value}
                    onChange={(e) =>
                      updateExtraField(index, { value: e.target.value })
                    }
                    className="w-1/2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => removeExtraField(index)}
                    className="text-slate-400 hover:text-red-600"
                    aria-label="Supprimer cette mesure"
                    disabled={loading}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addExtraField}
            className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            disabled={loading}
          >
            + Ajouter une mesure personnalisée
          </button>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Création..." : "Créer la commande"}
        </button>
      </form>
    </div>
  );
}
