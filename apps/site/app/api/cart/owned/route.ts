// GET /api/cart/owned (G16) — the signed-in account's already-owned catalog cart-item ids, for the
// add-to-cart button to disable/mark. Called client-side (not server-rendered) so the public
// marketing pages that host add-to-cart buttons stay statically generated; a signed-out caller
// gets an empty list, same as no ownership at all. Takes no body — everything derives from the
// verified session cookie (never a request param, security floor).
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getOwnedCartItemIds } from "@/lib/owned-cart-items";
import { SESSION_HINT_COOKIE_NAME } from "@/lib/session-hint-cookie";

// Tenant-scoped per-request read — never statically cached.
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  // ADR-0418: an optimization, NOT a trust boundary. Only the cookie's ABSENCE is trusted — it
  // short-circuits before resolving a session or touching the DB, for the common signed-out
  // visitor on every marketing page. Its PRESENCE grants nothing: a request that carries it still
  // falls through to the real session resolution below, so a stale/forged hint with no live
  // session just costs one wasted read in `getOwnedCartItemIds()`, never a false "owned".
  const jar = await cookies();
  if (jar.get(SESSION_HINT_COOKIE_NAME) === undefined) {
    return NextResponse.json(
      { owned: [] },
      { headers: { "cache-control": "private, no-store" } },
    );
  }
  const owned = await getOwnedCartItemIds();
  return NextResponse.json(
    { owned: [...owned] },
    { headers: { "cache-control": "private, no-store" } },
  );
}
