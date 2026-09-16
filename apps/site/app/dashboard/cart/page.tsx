// The authed checkout surface for the marketing site's cart. The cart itself lives in
// `localStorage` on this SAME origin (this app is the one unified Railway Next app, ADR-0114) —
// `CartProvider` re-reads it here, so a visitor who built a cart on the public `/pricing` page
// sees the same lines here. The checkout API independently resolves the session and current
// entitlements before creating a Paddle transaction (ADR-0424).
import type { Metadata } from "next";

import { CartCheckoutPanel } from "@/components/cart-checkout-panel";
import { requireDashboardSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Cart checkout" };

// The abandoned-checkout email's `?promo=<code>` link (SPEC-abandoned-checkout-email.md, discount
// fork, 2026-07-10 lock) — bounded + shape-checked server-side before it ever reaches Paddle.js.
const PROMO_CODE_RE = /^[A-Za-z0-9_-]+$/;

function parsePromoCode(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 64) return undefined;
  return PROMO_CODE_RE.test(trimmed) ? trimmed : undefined;
}

export default async function DashboardCartPage({
  searchParams,
}: {
  searchParams: Promise<{ promo?: string }>;
}) {
  await requireDashboardSession("/dashboard/cart");
  const { promo } = await searchParams;
  const promoCode = parsePromoCode(promo);

  // The cart context is provided by the root layout (app/layout.tsx) and reads the SAME
  // localStorage the public /pricing page wrote to — so the buyer's cart follows them here.
  // `exactOptionalPropertyTypes`-safe: spread the prop in only when set, never pass an explicit
  // `undefined` for an optional string prop.
  return (
    <CartCheckoutPanel {...(promoCode !== undefined ? { promoCode } : {})} />
  );
}
