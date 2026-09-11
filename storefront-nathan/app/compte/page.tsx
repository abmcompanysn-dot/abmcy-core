"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Download } from "lucide-react";
import {
  CustomerApiError,
  type CustomerOrder,
  clearToken,
  getMyOrderDelivery,
  getToken,
  listMyOrders,
  login,
  register,
  setToken,
} from "@/lib/customer-api";
import { formatFCFA } from "@/lib/format";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente de paiement",
  confirmed: "Confirmée",
  paid: "Payée",
  in_progress: "En cours",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export default function AccountPage() {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    function sync() {
      setConnected(!!getToken());
      setChecking(false);
    }
    sync();
  }, []);

  if (checking) return null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 sm:py-20">
      <h1 className="font-(family-name:--font-display) text-3xl font-bold text-text">
        Mon compte
      </h1>
      {connected ? (
        <OrdersView onLogout={() => setConnected(false)} />
      ) : (
        <AuthForm onAuthenticated={() => setConnected(true)} />
      )}
    </div>
  );
}

function AuthForm({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { token } =
        mode === "login"
          ? await login(phone, password)
          : await register(phone, email, password);
      setToken(token);
      onAuthenticated();
    } catch (err) {
      setError(
        err instanceof CustomerApiError
          ? err.message
          : "Impossible de vous connecter."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-8">
      <p className="text-sm text-text-muted">
        {mode === "login"
          ? "Connectez-vous avec le numéro utilisé lors de votre achat."
          : "Créez un mot de passe pour retrouver vos commandes. Le numéro doit correspondre à un achat déjà effectué."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text">
            Téléphone
          </label>
          <input
            required
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-bg-secondary px-4 py-3 text-sm text-text outline-none focus:border-accent"
          />
        </div>

        {mode === "register" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-bg-secondary px-4 py-3 text-sm text-text outline-none focus:border-accent"
            />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text">
            Mot de passe
          </label>
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-bg-secondary px-4 py-3 text-sm text-text outline-none focus:border-accent"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-accent-secondary/30 bg-accent-secondary/10 px-4 py-3 text-sm text-accent-secondary">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-accent px-7 py-3 text-sm font-semibold text-bg disabled:opacity-50"
        >
          {submitting
            ? "..."
            : mode === "login"
              ? "Se connecter"
              : "Créer mon accès"}
        </button>
      </form>

      <button
        onClick={() => setMode(mode === "login" ? "register" : "login")}
        className="mt-4 text-sm text-text-muted underline-offset-4 hover:text-accent hover:underline"
      >
        {mode === "login"
          ? "Première connexion ? Créer mon accès"
          : "Déjà un accès ? Se connecter"}
      </button>
    </div>
  );
}

function OrdersView({ onLogout }: { onLogout: () => void }) {
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, { filename: string; url: string }[]>>({});

  useEffect(() => {
    listMyOrders()
      .then(setOrders)
      .catch((err) => {
        setError(
          err instanceof CustomerApiError
            ? err.message
            : "Impossible de charger vos commandes."
        );
      });
  }, []);

  async function handleShowLinks(orderId: string) {
    try {
      const { files } = await getMyOrderDelivery(orderId);
      setLinks((prev) => ({ ...prev, [orderId]: files }));
    } catch {
      // le bouton "Télécharger" restera simplement inopérant si ça échoue
    }
  }

  function handleLogout() {
    clearToken();
    onLogout();
  }

  return (
    <div className="mt-8">
      <button
        onClick={handleLogout}
        className="text-sm text-text-muted underline-offset-4 hover:text-accent hover:underline"
      >
        Se déconnecter
      </button>

      {error && (
        <p className="mt-6 rounded-lg border border-accent-secondary/30 bg-accent-secondary/10 px-4 py-3 text-sm text-accent-secondary">
          {error}
        </p>
      )}

      {orders === null && !error ? (
        <p className="mt-6 text-sm text-text-muted">Chargement...</p>
      ) : orders && orders.length === 0 ? (
        <p className="mt-6 text-sm text-text-muted">
          Aucune commande pour le moment.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {orders?.map((o) => (
            <div
              key={o.id}
              className="rounded-xl border border-white/10 bg-bg-secondary p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-text">
                    {o.order_number}
                  </p>
                  <p className="text-xs text-text-muted">
                    {STATUS_LABELS[o.status] ?? o.status} ·{" "}
                    {formatFCFA(o.total_amount)}
                  </p>
                </div>
                {o.status === "paid" && (
                  <button
                    onClick={() => handleShowLinks(o.id)}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-text transition-colors hover:border-accent"
                  >
                    Retélécharger
                  </button>
                )}
              </div>

              {links[o.id] && (
                <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
                  {links[o.id].map((f) => (
                    <a
                      key={f.url}
                      href={f.url}
                      className="flex items-center justify-between text-sm text-accent"
                    >
                      {f.filename}
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
