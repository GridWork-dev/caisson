"use client";

import { useState } from "react";
import { Button } from "@caisson/ui/components";

import { openCartCheckout } from "@/lib/paddle-checkout";
import { formatUsd } from "@/lib/pricing";

import { useCart } from "./cart-provider";

export interface CartCheckoutPanelProps {
  /** The buyer's account id, resolved server-side from the session cookie
   *  (`requireDashboardSession` — never trusted from the client, security floor). */
  accountId: string;
}

/**
 * The authed pay screen: ONE Paddle overlay for every line in the cart (`openCartCheckout`,
 * `lib/paddle-checkout.ts`), stamped with the server-verified `accountId` as
 * `custom_data.account_id` — the same key the webhook's `parsePaddleEvent` already reads to
 * resolve the tenant (ADR-0116).
 */
export function CartCheckoutPanel({ accountId }: CartCheckoutPanelProps) {
  const { items, subtotal, clear } = useCart();
  const [opening, setOpening] = useState(false);

  async function pay() {
    setOpening(true);
    try {
      const opened = await openCartCheckout(
        items.map((item) => ({ priceId: item.priceId })),
        accountId,
      );
      // The Paddle overlay owns the rest of the flow once it opens; clear the local cart
      // optimistically so a buyer who navigates back doesn't re-submit the same lines. A
      // cancelled checkout just means an empty cart to rebuild from /pricing — a smaller cost
      // than a resubmitted duplicate purchase.
      if (opened) clear();
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
          {items.length} item{items.length === 1 ? "" : "s"} — one Paddle
          checkout for the whole cart.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="cs-muted">
          Your cart is empty. Go back to pricing to add an edition or a module.
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
            disabled={opening}
            onClick={() => void pay()}
          >
            {opening ? "Opening…" : "Pay now"}
          </Button>
        </>
      )}
    </div>
  );
}
