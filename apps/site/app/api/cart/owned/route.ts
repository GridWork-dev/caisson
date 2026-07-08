// GET /api/cart/owned (G16) — the signed-in account's already-owned catalog cart-item ids, for the
// add-to-cart button to disable/mark. Called client-side (not server-rendered) so the public
// marketing pages that host add-to-cart buttons stay statically generated; a signed-out caller
// gets an empty list, same as no ownership at all. Takes no body — everything derives from the
// verified session cookie (never a request param, security floor).
import { NextResponse } from "next/server";
import { getOwnedCartItemIds } from "@/lib/owned-cart-items";

// Tenant-scoped per-request read — never statically cached.
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const owned = await getOwnedCartItemIds();
  return NextResponse.json(
    { owned: [...owned] },
    { headers: { "cache-control": "private, no-store" } },
  );
}
