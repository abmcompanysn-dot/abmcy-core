import { NextResponse } from "next/server";
import { ApiError, createOrder, initPayment } from "@/lib/api";

// Route serveur : seule façon dont le panier côté navigateur peut créer une
// commande et initier un paiement, puisque la clé API (X-API-Key) ne doit
// jamais atteindre le JavaScript client. Le prix n'est jamais lu ici — on
// ne transmet que product_id/quantity, le total vient du serveur ABMCY.
export async function POST(request: Request) {
  let body: {
    customer_name?: string;
    customer_phone?: string;
    customer_email?: string;
    items?: { product_id: string; quantity: number }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Requête invalide." },
      { status: 400 }
    );
  }

  if (
    !body.customer_name?.trim() ||
    !body.customer_phone?.trim() ||
    !body.items?.length
  ) {
    return NextResponse.json(
      { error: "Nom, téléphone et panier sont obligatoires." },
      { status: 400 }
    );
  }

  try {
    const order = await createOrder({
      customer_name: body.customer_name.trim(),
      customer_phone: body.customer_phone.trim(),
      customer_email: body.customer_email?.trim() || undefined,
      items: body.items,
    });

    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    const returnUrl = `${origin}/merci?order=${order.id}`;
    const { payment_url } = await initPayment(order.id, returnUrl);

    return NextResponse.json({ order_id: order.id, payment_url });
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Impossible de créer la commande.";
    const status = err instanceof ApiError && err.status ? err.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
