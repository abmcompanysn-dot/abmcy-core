"use client";

import Link from "next/link";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import AuthGate from "@/components/admin/AuthGate";
import { decodeStaffRole } from "@/lib/admin-api";

function AdminNav() {
  const { token, logout } = useAuth();
  if (!token) return null;
  const role = decodeStaffRole(token);

  return (
    <nav className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3 sm:px-8">
      <Link
        href="/admin"
        className="font-[family-name:var(--font-display)] text-lg text-[var(--text-main)]"
      >
        Admin MAHU
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <Link href="/admin/nouveau" className="text-[var(--accent-red)]">
          + Nouvel article
        </Link>
        <Link href="/admin/stats" className="text-[var(--text-muted)]">
          Stats
        </Link>
        {role === "owner" ? (
          <Link href="/admin/equipe" className="text-[var(--text-muted)]">
            Équipe
          </Link>
        ) : null}
        <Link href="/" className="text-[var(--text-muted)]">
          Voir le site
        </Link>
        <button onClick={logout} className="text-[var(--text-muted)]">
          Déconnexion
        </button>
      </div>
    </nav>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AdminNav />
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}
