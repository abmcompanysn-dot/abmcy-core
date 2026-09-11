"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { cartTotal, clearCart, getCart, type CartLine } from "@/lib/cart";
import { formatFCFA } from "@/lib/format";

export default function CheckoutPage() {
  const router = useRouter();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function sync() {
      const cart = getCart();
      setLines(cart);
      if (cart.length === 0) router.replace("/panier");
    }
    sync();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name,
          customer_phone: phone,
          customer_email: email || undefined,
          items: lines.map((l) => ({
            product_id: l.productId,
            quantity: l.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Impossible de créer la commande.");
        setSubmitting(false);
        return;
      }
      clearCart();
      window.location.href = data.payment_url;
    } catch {
      setError("Impossible de contacter le serveur. Réessayez.");
      setSubmitting(false);
    }
  }

  const total = cartTotal(lines);

  return (
    <div className="mx-auto max-w-lg px-6 py-16 sm:py-20">
      <h1 className="font-(family-name:--font-display) text-3xl font-bold text-text">
        Finaliser la commande
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        Vous serez redirigé(e) vers la page de paiement sécurisée après cette
        étape.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label
            htmlFor="name"
            className="mb-1.5 block text-sm font-medium text-text"
          >
            Nom complet
          </label>
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-bg-secondary px-4 py-3 text-sm text-text outline-none focus:border-accent"
          />
        </div>

        <div>
          <label
            htmlFor="phone"
            className="mb-1.5 block text-sm font-medium text-text"
          >
            Téléphone (Wave, Orange Money, MTN MoMo...)
          </label>
          <input
            id="phone"
            type="tel"
            required
            placeholder="+221 77 123 45 67"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-bg-secondary px-4 py-3 text-sm text-text outline-none focus:border-accent"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-text"
          >
            Email <span className="text-text-muted">(optionnel — pour recevoir votre lien de téléchargement)</span>
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-bg-secondary px-4 py-3 text-sm text-text outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-bg-secondary px-4 py-3">
          <span className="text-sm text-text-muted">Total</span>
          <span className="text-lg font-bold text-accent">
            {formatFCFA(total)}
          </span>
        </div>

        {error && (
          <p className="rounded-lg border border-accent-secondary/30 bg-accent-secondary/10 px-4 py-3 text-sm text-accent-secondary">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || lines.length === 0}
          className="w-full rounded-full bg-accent px-7 py-3.5 text-center text-sm font-semibold text-bg shadow-lg shadow-accent/20 transition-transform hover:scale-[1.01] disabled:opacity-50"
        >
          {submitting ? "Redirection..." : "Payer maintenant"}
        </button>
      </form>
    </div>
  );
}
