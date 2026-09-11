import { NextResponse } from "next/server";
import { ApiError, getOrderDelivery } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const delivery = await getOrderDelivery(id);
    return NextResponse.json(delivery);
  } catch (err) {
    const status = err instanceof ApiError && err.status ? err.status : 500;
    const message =
      err instanceof ApiError ? err.message : "Impossible de charger les liens.";
    return NextResponse.json({ error: message }, { status });
  }
}
