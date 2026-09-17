"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { ApiError, acceptCGU, getSubscription, type Subscription } from "@/lib/api";

/**
 * Bloque l'accès au dashboard tant que le owner n'a pas explicitement
 * accepté les CGU d'ABMCY Core — vérifié une fois par session (pas à
 * chaque navigation) pour ne pas gêner l'usage quotidien une fois
 * accepté. N'affiche rien tant que le statut n'est pas encore connu,
 * pour éviter un flash du contenu protégé.
 */
export function CGUGate({ children }: { children: ReactNode }) {
  const { apiKey } = useAuth();
  const { showToast } = useToast();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [checked, setChecked] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    getSubscription(apiKey)
      .then((sub) => {
        if (!cancelled) setSubscription(sub);
      })
      .catch(() => {
        // Facturation pas encore configurée pour ce tenant — ne bloque
        // jamais l'accès dans ce cas, seule une vraie réponse
        // "non acceptées" doit le faire.
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  // Sans clé API, AuthGate affiche déjà le formulaire de connexion avant
  // ce composant — "checked" reste dérivé de l'absence de clé plutôt que
  // posé depuis l'effet, pour ne jamais bloquer sur cet état.
  const isChecked = checked || !apiKey;

  async function handleAccept() {
    if (!apiKey || accepting) return;
    setAccepting(true);
    try {
      await acceptCGU(apiKey);
      setSubscription((s) => (s ? { ...s, cgu_accepted_at: new Date().toISOString() } : s));
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Impossible d'enregistrer votre acceptation.",
        "error"
      );
    } finally {
      setAccepting(false);
    }
  }

  if (!isChecked) return null;

  if (subscription && !subscription.cgu_accepted_at) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">
            Conditions d&apos;utilisation
          </h1>
          <p className="text-sm text-slate-600">
            Avant de continuer, veuillez lire et accepter les{" "}
            <a
              href="https://cors.abmcy.com/cgu"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-indigo-600 hover:underline"
            >
              conditions d&apos;utilisation d&apos;ABMCY Core
            </a>
            , éditées par Mahu Digital System.
          </p>
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {accepting ? "Enregistrement..." : "J'accepte les conditions d'utilisation"}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
