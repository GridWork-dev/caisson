"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";
// The /fetch subpath is the client-safe cut of the kernel (fetch.ts is pure, no server-only
// imports) — mirrors `discord-connect.tsx`'s own client-side fetchWithTimeout usage.
import { fetchWithTimeout } from "@caisson/kernel/fetch";
import { Button, EmptyState } from "@caisson/ui/components";

import { PADDLE_MOR_DISCLOSURE } from "@/lib/legal";
import {
  isPaddleConfigured,
  onCheckoutCompleted,
  openCartTransaction,
} from "@/lib/paddle-checkout";
import { formatUsd } from "@/lib/pricing";

import { useCart } from "./cart-provider";

const checkoutResponseSchema = z
  .object({
    transactionId: z.string().regex(/^txn_[a-z0-9]{26}$/),
    removed: z.array(z.string().max(128)).max(50),
  })
  .strict();

export interface CartCheckoutPanelProps {
  /** The validated `?promo=` search param (server-validated shape, `dashboard/cart/page.tsx`) —
   *  threaded straight into `Paddle.Checkout.open({ discountCode })` when present. */
  promoCode?: string;
}

/** The server filters current entitlements and creates the Paddle transaction (ADR-0424). */
export function CartCheckoutPanel({ promoCode }: CartCheckoutPanelProps) {
  const { items, subtotal, clear } = useCart();
  const [notice, setNotice] = useState<string | null>(null);
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
    setNotice(null);
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

      const response = await fetchWithTimeout(
        "/api/cart/checkout",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            itemIds: items.map((item) => item.id),
            ...(promoCode === undefined ? {} : { promoCode }),
          }),
        },
        { timeoutMs: 35_000 },
      );
      const result: unknown = await response.json();
      const parsed = checkoutResponseSchema.safeParse(result);
      if (!response.ok || !parsed.success) {
        setError(
          response.status === 409
            ? "You already own these items. No checkout was created."
            : "Checkout is unavailable right now. Please try again.",
        );
        return;
      }
      if (parsed.data.removed.length > 0)
        setNotice(
          "Already-owned items were removed from checkout. Review the updated total in Paddle before paying.",
        );
      const opened = await openCartTransaction(parsed.data.transactionId);
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
        {items.length > 0 ? (
          <p className="cs-muted" style={{ marginTop: "var(--cs-space-2)" }}>
            {items.length} item{items.length === 1 ? "" : "s"}. One Paddle
            checkout for the whole cart.
          </p>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="cart"
          title="Your cart is empty"
          description="Add a bundle or a module from the marketplace to start a checkout."
          action={
            <Button asChild variant="primary">
              <Link href="/marketplace">Browse the marketplace</Link>
            </Button>
          }
        />
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

          {notice !== null && (
            <p role="status" className="cs-footnote">
              {notice}
            </p>
          )}
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
