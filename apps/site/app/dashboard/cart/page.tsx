// The authed checkout surface for the marketing site's cart. The cart itself lives in
// `localStorage` on this SAME origin (this app is the one unified Railway Next app, ADR-0114) —
// `CartProvider` re-reads it here, so a visitor who built a cart on the public `/pricing` page
// sees the SAME lines once they land on this authed route. The one thing this page adds is the
// server-verified `accountId` a Paddle multi-item checkout needs as `custom_data` (resolved from
// the session cookie by `requireDashboardSession` — never trusted from the client, security
// floor).
import type { Metadata } from "next";

import { CartCheckoutPanel } from "@/components/cart-checkout-panel";
import { requireDashboardSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Cart checkout" };

export default async function DashboardCartPage() {
  const session = await requireDashboardSession("/dashboard/cart");

  // The cart context is provided by the root layout (app/layout.tsx) and reads the SAME
  // localStorage the public /pricing page wrote to — so the buyer's cart follows them here.
  return <CartCheckoutPanel accountId={session.accountId} />;
}
