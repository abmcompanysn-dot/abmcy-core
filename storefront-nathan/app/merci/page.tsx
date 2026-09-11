"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Download, Loader2 } from "lucide-react";

interface OrderView {
  order_number: string;
  status: string;
}

interface DeliveryFile {
  filename: string;
  url: string;
  expires_at: string;
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

function ThankYouContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");

  const [order, setOrder] = useState<OrderView | null>(null);
  const [files, setFiles] = useState<DeliveryFile[] | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startRef = useRef<number | null>(null);

  const fetchDelivery = useCallback(async (id: string) => {
    const res = await fetch(`/api/orders/${id}/delivery`);
    if (res.ok) {
      const data = await res.json();
      setFiles(data.files ?? []);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!orderId) {
      const fail = () => setError("Commande introuvable.");
      fail();
      return;
    }

    startRef.current = Date.now();

    async function poll() {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!cancelled) setError(data.error ?? "Commande introuvable.");
          return;
        }
        const data: OrderView = await res.json();
        if (cancelled) return;
        setOrder(data);

        if (data.status === "paid") {
          await fetchDelivery(orderId!);
          return;
        }

        if (Date.now() - (startRef.current ?? Date.now()) > POLL_TIMEOUT_MS) {
          setTimedOut(true);
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (!cancelled) setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [orderId, fetchDelivery]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="text-accent-secondary">{error}</p>
      </div>
    );
  }

  const paid = order?.status === "paid";

  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center sm:py-24">
      {paid ? (
        <CheckCircle2
          className="mx-auto h-14 w-14 text-success"
          strokeWidth={1.5}
        />
      ) : (
        <Loader2
          className="mx-auto h-14 w-14 animate-spin text-accent"
          strokeWidth={1.5}
        />
      )}

      <h1 className="mt-6 font-(family-name:--font-display) text-3xl font-bold text-text">
        {paid ? "Paiement confirmé" : "Confirmation en cours..."}
      </h1>

      {order && (
        <p className="mt-2 text-sm text-text-muted">
          Commande {order.order_number}
        </p>
      )}

      {!paid && !timedOut && (
        <p className="mt-4 text-sm text-text-muted">
          Nous attendons la confirmation de votre opérateur mobile money.
          Cela prend généralement quelques secondes.
        </p>
      )}

      {!paid && timedOut && (
        <p className="mt-4 text-sm text-text-muted">
          La confirmation prend plus de temps que prévu. Un email vous sera
          envoyé dès que le paiement sera confirmé — vous pouvez aussi
          actualiser cette page.
        </p>
      )}

      {paid && files && files.length > 0 && (
        <div className="mt-10 space-y-3 text-left">
          {files.map((f) => (
            <a
              key={f.url}
              href={f.url}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-bg-secondary px-4 py-3.5 transition-colors hover:border-accent"
            >
              <span className="truncate text-sm font-medium text-text">
                {f.filename}
              </span>
              <Download className="h-4 w-4 shrink-0 text-accent" />
            </a>
          ))}
          <p className="pt-2 text-xs text-text-muted">
            Liens valables 15 minutes. Un email de confirmation avec ces
            liens vous a aussi été envoyé si vous avez renseigné votre
            adresse.
          </p>
        </div>
      )}
    </div>
  );
}

export default function ThankYouPage() {
  return (
    <Suspense fallback={null}>
      <ThankYouContent />
    </Suspense>
  );
}
