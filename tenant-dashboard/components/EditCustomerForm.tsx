"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import {
  ApiError,
  staffSetCustomerPassword,
  updateCustomer,
  type Customer,
} from "@/lib/api";

/** Formulaire d'édition d'un client, en modal — coordonnées + mot de
 * passe dans un même écran, mais deux soumissions distinctes côté API
 * (PATCH /customers/{id} pour les infos, PUT .../password pour le mot de
 * passe — voir internal/auth/customer.go StaffSetCustomerPassword). */
export function EditCustomerForm({
  customer,
  onUpdated,
  onClose,
}: {
  customer: Customer;
  onUpdated: (customer: Customer) => void;
  onClose: () => void;
}) {
  const { apiKey } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [email, setEmail] = useState(customer.email ?? "");
  const [shippingAddress, setShippingAddress] = useState(
    customer.shipping_address ?? ""
  );
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function handleInfoSubmit(e: FormEvent) {
    e.preventDefault();
    if (!apiKey) return;
    setInfoError(null);

    if (!name.trim() || !phone.trim()) {
      setInfoError("Le nom et le téléphone sont obligatoires.");
      return;
    }

    setSavingInfo(true);
    try {
      const updated = await updateCustomer(apiKey, customer.id, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        shipping_address: shippingAddress.trim(),
      });
      onUpdated(updated);
      showToast("Informations du client mises à jour.");
    } catch (err) {
      setInfoError(
        err instanceof ApiError
          ? err.message
          : "Impossible de mettre à jour ce client."
      );
    } finally {
      setSavingInfo(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (!apiKey) return;
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setSavingPassword(true);
    try {
      await staffSetCustomerPassword(apiKey, customer.id, newPassword);
      setNewPassword("");
      onUpdated({ ...customer, has_password: true });
      showToast(`Mot de passe de ${customer.name} mis à jour.`);
    } catch (err) {
      setPasswordError(
        err instanceof ApiError
          ? err.message
          : "Impossible de mettre à jour le mot de passe."
      );
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Modifier le client
          </h2>
          <button
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            Fermer
          </button>
        </div>

        <form onSubmit={handleInfoSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Nom *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                disabled={savingInfo}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Téléphone *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                disabled={savingInfo}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                disabled={savingInfo}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Adresse de livraison
              </label>
              <textarea
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                disabled={savingInfo}
              />
            </div>
          </div>

          {infoError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {infoError}
            </p>
          )}

          <button
            type="submit"
            disabled={savingInfo}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {savingInfo ? "Enregistrement..." : "Enregistrer les informations"}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-200 pt-6">
          <h3 className="mb-1 text-sm font-semibold text-slate-900">
            Mot de passe
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            {customer.has_password
              ? "Ce client a déjà un mot de passe pour suivre ses commandes en ligne. Définir un nouveau mot de passe remplace l'ancien immédiatement."
              : "Ce client n'a pas encore de mot de passe — il ne peut pas encore se connecter à son suivi de commande en ligne."}
          </p>
          <form onSubmit={handlePasswordSubmit} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Nouveau mot de passe
              </label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Au moins 8 caractères"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                disabled={savingPassword}
              />
            </div>
            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {savingPassword ? "..." : "Définir"}
            </button>
          </form>
          {passwordError && (
            <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {passwordError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
