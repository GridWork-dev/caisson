"use client";

import Link from "next/link";

import { Button, Card } from "@/components";
import { formatUsd } from "@/lib/pricing";

import { useCart } from "./cart-provider";
import {
  CartLineItem,
  CartPrunedNotice,
  CartTrustNote,
  CartUpgradeCallout,
} from "./cart-shared";
import styles from "./cart.module.css";

/** The `/cart` page body — the RICH surface (D-5, ADR-0193): full-density line items, the honest
 *  bundle nudge, a procurement on-ramp, then checkout. Shares its line item + nudge + trust note
 *  with the drawer, differing only in depth. Checkout itself is gated (`/dashboard/cart`,
 *  `requireDashboardSession`): the CTA navigates there and an unauthenticated visitor is bounced to
 *  `/login?next=/dashboard/cart` by the existing dashboard auth gate. */
export function CartView() {
  const { items, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <div style={{ display: "grid", gap: "var(--cs-space-4)" }}>
        <CartPrunedNotice />
        <Card>
          <p className="cs-muted">Your cart is empty.</p>
          <div style={{ marginTop: "var(--cs-space-4)" }}>
            <Button href="/marketplace" variant="primary">
              Browse editions &amp; modules
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{ display: "grid", gap: "var(--cs-space-6)", maxWidth: "40rem" }}
    >
      <CartPrunedNotice />
      <ul className={styles.lines}>
        {items.map((item) => (
          <CartLineItem key={item.id} item={item} density="comfortable" />
        ))}
      </ul>

      <CartUpgradeCallout />

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
        <div style={{ marginTop: "var(--cs-space-2)" }}>
          <CartTrustNote />
        </div>
        <div style={{ marginTop: "var(--cs-space-5)" }}>
          <Button href="/dashboard/cart" variant="primary">
            Checkout
          </Button>
        </div>
      </Card>

      <p className="cs-footnote">
        Buying for a team?{" "}
        <Link href="/procurement">Purchase orders &amp; invoicing →</Link>
      </p>
    </div>
  );
}
