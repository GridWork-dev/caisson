"use client";

import { Icon } from "@caisson/ui/components";

import { Button, Card } from "@/components";
import { formatUsd } from "@/lib/pricing";

import { useCart } from "./cart-provider";

/** The `/cart` page body — full line-item review + remove + subtotal. Checkout itself is gated
 *  (`/dashboard/cart`, `requireDashboardSession`): the "Checkout" CTA below just navigates there,
 *  and an unauthenticated visitor is bounced to `/login?next=/dashboard/cart` by the existing
 *  dashboard auth gate — the same pattern the pricing page's single-item `CheckoutCta` already
 *  uses for `/dashboard/plan`. */
export function CartView() {
  const { items, subtotal, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <Card>
        <p className="cs-muted">Your cart is empty.</p>
        <div style={{ marginTop: "var(--cs-space-4)" }}>
          <Button href="/pricing" variant="primary">
            Browse editions &amp; modules
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: "var(--cs-space-4)",
        maxWidth: "36rem",
      }}
    >
      {items.map((item) => (
        <Card key={item.id}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "var(--cs-space-4)",
            }}
          >
            <div>
              <span className="cs-card-title">{item.label}</span>
              <p
                className="cs-muted"
                style={{
                  fontSize: "var(--cs-text-xs)",
                  marginTop: "var(--cs-space-1)",
                  textTransform: "capitalize",
                }}
              >
                {item.kind}
              </p>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--cs-space-4)",
              }}
            >
              <span
                className="cs-num"
                style={{ fontFamily: "var(--cs-font-mono)" }}
              >
                {formatUsd(item.amount)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${item.label} from cart`}
                onClick={() => removeItem(item.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--cs-fg-muted)",
                }}
              >
                <Icon name="x" />
              </button>
            </div>
          </div>
        </Card>
      ))}

      <Card accent>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <span className="cs-card-title">Subtotal</span>
          <span
            className="cs-num"
            style={{
              fontFamily: "var(--cs-font-mono)",
              fontSize: "var(--cs-text-xl)",
            }}
          >
            {formatUsd(subtotal)}
          </span>
        </div>
        <p className="cs-footnote" style={{ marginTop: "var(--cs-space-2)" }}>
          One-time perpetual licenses, billed once — no seat count, no renewal
          gate.
        </p>
        <div style={{ marginTop: "var(--cs-space-5)" }}>
          <Button href="/dashboard/cart" variant="primary">
            Checkout
          </Button>
        </div>
      </Card>
    </div>
  );
}
