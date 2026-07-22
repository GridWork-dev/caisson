"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
// The /fetch subpath is the client-safe cut of the kernel (fetch.ts is pure, no server-only
// imports) — mirrors `discord-connect.tsx`'s own client-side fetchWithTimeout usage.
import { fetchWithTimeout } from "@caisson/kernel/fetch";
import { Button } from "@caisson/ui/components";

import { PADDLE_MOR_DISCLOSURE } from "@/lib/legal";
import {
  isPaddleConfigured,
  onCheckoutCompleted,
  openCartCheckout,
} from "@/lib/paddle-checkout";
import { formatUsd } from "@/lib/pricing";

import { useCart } from "./cart-provider";

export interface CartCheckoutPanelProps {
  /** The buyer's account id, resolved server-side from the session cookie
   *  (`requireDashboardSession` — never trusted from the client, security floor). */
  accountId: string;
  /** The validated `?promo=` search param (server-validated shape, `dashboard/cart/page.tsx`) —
   *  threaded straight into `Paddle.Checkout.open({ discountCode })` when present. */
  promoCode?: string;
}

/**
 * The authed pay screen: ONE Paddle overlay for every line in the cart (`openCartCheckout`,
 * `lib/paddle-checkout.ts`), stamped with the server-verified `accountId` as
 * `custom_data.account_id` — the same key the webhook's `parsePaddleEvent` already reads to
 * resolve the tenant (ADR-0116).
 */
export function CartCheckoutPanel({
  accountId,
  promoCode,
}: CartCheckoutPanelProps) {
  const { items, subtotal, clear } = useCart();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isPaddleConfigured();

  // G35: clear only when Paddle reports `checkout.completed` — payment actually succeeded — not
  // the instant the overlay opens. A buyer who opens the overlay to review the total then cancels
  // (or a card decline) now keeps their cart, instead of losing it to an optimistic pre-clear.
  useEffect(() => onCheckoutCompleted(clear), [clear]);

  async function pay() {
    setOpening(true);
    setError(null);
    try {
      // Abandoned-checkout capture (SPEC-abandoned-checkout-email.md §(a)): fire-and-forget, NEVER
      // awaited into the checkout path — a slow or failed capture must not delay or block
      // `Paddle.Checkout.open` below.
      void fetchWithTimeout(
        "/api/checkout/started",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items: items.map((item) => ({ id: item.id, label: item.label })),
          }),
        },
        { timeoutMs: 5_000 },
      ).catch(() => {
        // Best-effort capture — a missed nudge email is not worth surfacing to the buyer.
      });

      const opened = await openCartCheckout(
        items.map((item) => ({ priceId: item.priceId })),
        accountId,
        promoCode,
      );
      // The Paddle overlay owns the rest of the flow once it opens — the cart clears on the
      // `checkout.completed` event (the useEffect above), not here.
      if (!opened) {
        setError("Checkout is unavailable right now. Please try again.");
      }
    } catch {
      // G6: getPaddle() now surfaces a load/init failure instead of silently poisoning the
      // session — give the buyer a real, actionable message instead of a button that just reverts.
      setError(
        "Checkout failed to load. Check your connection or ad-blocker, then try again.",
      );
    } finally {
      setOpening(false);
    }
  }

  return (
    <div
      style={{ display: "grid", gap: "var(--cs-space-6)", maxWidth: "36rem" }}
    >
      <div>
        <h1
          className="cs-card-title"
          style={{ fontSize: "var(--cs-text-2xl)" }}
        >
          Checkout
        </h1>
        <p className="cs-muted" style={{ marginTop: "var(--cs-space-2)" }}>
          {items.length === 0
            ? "Nothing in your cart yet."
            : `${String(items.length)} item${items.length === 1 ? "" : "s"}. One Paddle checkout for the whole cart.`}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="cs-muted">
          Your cart is empty. Head to the{" "}
          <Link href="/marketplace">marketplace</Link> to add a bundle or a
          module.
        </p>
      ) : (
        <>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "grid",
              gap: "var(--cs-space-2)",
            }}
          >
            {items.map((item) => (
              <li
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "var(--cs-text-sm)",
                }}
              >
                <span>{item.label}</span>
                <span
                  className="cs-num"
                  style={{ fontFamily: "var(--cs-font-mono)" }}
                >
                  {formatUsd(item.amount)}
                </span>
              </li>
            ))}
          </ul>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderTop: "1px solid var(--cs-border)",
              paddingTop: "var(--cs-space-3)",
            }}
          >
            <span className="cs-card-title">Total</span>
            <span
              className="cs-num"
              style={{
                fontFamily: "var(--cs-font-mono)",
                fontSize: "var(--cs-text-lg)",
              }}
            >
              {formatUsd(subtotal)}
            </span>
          </div>

          <Button
            type="button"
            variant="primary"
            disabled={!configured || opening}
            onClick={() => void pay()}
          >
            {!configured
              ? "Checkout unavailable"
              : opening
                ? "Opening…"
                : "Pay now"}
          </Button>

          {error !== null && (
            <p className="cs-footnote" style={{ color: "var(--cs-danger)" }}>
              {error}
            </p>
          )}

          <p className="cs-footnote">{PADDLE_MOR_DISCLOSURE}</p>
        </>
      )}
    </div>
  );
}
