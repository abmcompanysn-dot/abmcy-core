import { NextResponse } from "next/server";
import { ApiError, getOrder } from "@/lib/api";

// Proxy serveur pour le poll de statut depuis la page /merci — le
// navigateur n'a pas la clé API, donc il ne peut pas appeler
// api.abmcy.com directement.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const order = await getOrder(id);
    return NextResponse.json(order);
  } catch (err) {
    const status = err instanceof ApiError && err.status ? err.status : 500;
    const message =
      err instanceof ApiError ? err.message : "Impossible de charger la commande.";
    return NextResponse.json({ error: message }, { status });
  }
}
