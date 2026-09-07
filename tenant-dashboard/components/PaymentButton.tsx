"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError, initPayment, type Order } from "@/lib/api";

export function PaymentButton({ order }: { order: Order }) {
  const { apiKey } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  async function handleClick() {
    if (!apiKey) return;
    setLoading(true);
    setError(null);
    try {
      const returnUrl =
        typeof window !== "undefined" ? window.location.href : "";
      const result = await initPayment(apiKey, {
        order_id: order.id,
        amount: order.total_amount,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        return_url: returnUrl,
      });
      setPaymentUrl(result.payment_url);
      if (typeof window !== "undefined") {
        window.open(result.payment_url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible d'initier le paiement."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Initiation..." : "Initier le paiement"}
      </button>
      {error && <p className="max-w-xs text-right text-xs text-red-600">{error}</p>}
      {paymentUrl && (
        <a
          href={paymentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="max-w-xs truncate text-right text-xs text-indigo-600 underline"
        >
          Lien de paiement
        </a>
      )}
    </div>
  );
}
