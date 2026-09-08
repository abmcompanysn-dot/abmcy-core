"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, createStaff, type StaffUser } from "@/lib/api";

/** Formulaire d'ajout d'un membre de l'équipe — réservé au rôle owner
 * (vérifié côté backend, voir handleCreateStaff ; le bouton n'apparaît
 * de toute façon pas pour un rôle staff, voir app/equipe/page.tsx). */
export function NewStaffForm({
  onCreated,
}: {
  onCreated: (staff: StaffUser) => void;
}) {
  const { apiKey } = useAuth();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"staff" | "owner">("staff");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setEmail("");
    setPassword("");
    setRole("staff");
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!apiKey) return;
    setError(null);

    if (!email.trim() || password.length < 8) {
      setError("Email requis et mot de passe d'au moins 8 caractères.");
      return;
    }

    setLoading(true);
    try {
      const staff = await createStaff(apiKey, {
        email: email.trim(),
        password,
        role,
      });
      onCreated(staff);
      showToast(`${staff.email} a été ajouté(e) à l'équipe.`);
      resetForm();
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible d'ajouter ce membre de l'équipe."
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
        + Ajouter un membre
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          Nouveau membre de l&apos;équipe
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

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Mot de passe (8 caractères min.) *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Rôle
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "staff" | "owner")}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:w-auto"
            disabled={loading}
          >
            <option value="staff">Staff (accès standard)</option>
            <option value="owner">Owner (gère aussi l&apos;équipe)</option>
          </select>
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
          {loading ? "Création..." : "Ajouter"}
        </button>
      </form>
    </div>
  );
}
