"use client";

import { useState } from "react";
import { Button, Card, StatusPill } from "@caisson/ui/components";
import type { EntitlementStatus } from "@caisson/ui/components";
import { isPaddleConfigured, openCheckout } from "@/lib/paddle-checkout";

export interface UpdatesWindowCardProps {
  entitlementId: string;
  accountId: string;
  /** Whether this entitlement is subscription-sourced — its own license expiry governs, no
   *  per-entitlement window and no renew action. */
  subscriptionSourced: boolean;
  /** The ADR-0255 per-entitlement updates-window bound, or `null` when unbounded (no window
   *  entry — an operator comp, or a pre-window token). */
  windowExpiry: string | null;
  /** The RENEWAL_BOOK Paddle price id that extends this entitlement's window, if one exists. */
  renewalPriceId?: string | undefined;
  /** Display price for the renewal in whole USD (the ADR-0260 §5 40%-X9 ladder, computed from
   *  the live list price and parity-checked against the Paddle row). Null/absent = number-free
   *  button; the Paddle overlay stays the authoritative display (ADR-0130). */
  renewalUsd?: number | null;
}

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

/** One owned entitlement's updates-window row: subscription-included, unbounded, or a dated
 * window with a "Renew updates" action (a one-time RENEWAL_BOOK purchase, never a subscription —
 * mirrors `PlanPurchaseRow`'s open-checkout pattern). */
export function UpdatesWindowCard({
  entitlementId,
  accountId,
  subscriptionSourced,
  windowExpiry,
  renewalPriceId,
  renewalUsd,
}: UpdatesWindowCardProps) {
  const [opening, setOpening] = useState(false);
  const configured = isPaddleConfigured();

  async function renew() {
    if (!renewalPriceId) return;
    setOpening(true);
    try {
      await openCheckout({ priceId: renewalPriceId, accountId });
    } finally {
      setOpening(false);
    }
  }

  let status: EntitlementStatus = "active";
  let statusLabel: string | undefined;
  let hint: string;

  if (subscriptionSourced) {
    hint = "Included with your subscription.";
  } else if (windowExpiry === null) {
    hint = "Unbounded — no updates window tracked.";
  } else {
    const expiresAt = new Date(windowExpiry);
    const msLeft = expiresAt.getTime() - Date.now();
    if (msLeft < 0) {
      status = "expired";
      statusLabel = "Lapsed";
    } else if (msLeft <= SIXTY_DAYS_MS) {
      status = "pending";
      statusLabel = "Expiring soon";
    }
    // timeZone pinned: this SSRs in the server's TZ and hydrates in the client's — an unpinned
    // format can differ by a day near a UTC boundary (hydration text mismatch).
    hint = `Updates through ${expiresAt.toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" })}.`;
  }

  const showRenew =
    !subscriptionSourced &&
    windowExpiry !== null &&
    renewalPriceId !== undefined;

  return (
    <Card>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "var(--cs-space-3)",
          flexWrap: "wrap",
        }}
      >
        <span className="cs-card-title" style={{ textTransform: "capitalize" }}>
          {entitlementId.replace(/-/g, " ")}
        </span>
        <StatusPill status={status}>{statusLabel}</StatusPill>
      </div>

      <p
        className="cs-muted"
        style={{
          marginTop: "var(--cs-space-2)",
          fontSize: "var(--cs-text-sm)",
        }}
      >
        {hint}
      </p>

      {showRenew && (
        <div style={{ marginTop: "var(--cs-space-4)" }}>
          <Button
            type="button"
            variant="primary"
            disabled={!configured || opening}
            onClick={() => void renew()}
          >
            {!configured
              ? "Checkout unavailable"
              : opening
                ? "Opening…"
                : typeof renewalUsd === "number"
                  ? `Renew updates — $${renewalUsd.toLocaleString("en-US")}/yr`
                  : "Renew updates"}
          </Button>
        </div>
      )}
    </Card>
  );
}
