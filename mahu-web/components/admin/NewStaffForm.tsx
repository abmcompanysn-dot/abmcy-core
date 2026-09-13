"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { createStaff, type StaffUser } from "@/lib/admin-api";

export default function NewStaffForm({
  onCreated,
}: {
  onCreated: (staff: StaffUser) => void;
}) {
  const { token } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"owner" | "staff">("staff");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const staff = await createStaff(token, {
        email: email.trim(),
        password,
        role,
      });
      onCreated(staff);
      setEmail("");
      setPassword("");
      setRole("staff");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible de créer ce compte."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 rounded border border-[var(--border-color)] bg-[var(--bg-card)] p-6"
    >
      <h2 className="mb-4 font-[family-name:var(--font-display)] text-lg text-[var(--text-main)]">
        Ajouter un membre de l&apos;équipe
      </h2>

      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          className="rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-main)]"
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
          className="rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-main)]"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "owner" | "staff")}
          disabled={loading}
          className="rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-main)]"
        >
          <option value="staff">Staff (articles uniquement)</option>
          <option value="owner">Owner (accès complet)</option>
        </select>
      </div>

      {error ? (
        <p className="mb-3 text-sm text-[var(--accent-red)]">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded bg-[var(--accent-red)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Création..." : "Ajouter"}
      </button>
    </form>
  );
}
