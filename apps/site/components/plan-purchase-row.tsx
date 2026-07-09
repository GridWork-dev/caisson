"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Button, Card } from "@caisson/ui/components";
import { isPaddleConfigured, openCheckout } from "@/lib/paddle-checkout";
import { BUNDLE_PRICES } from "@/lib/pricing";

/**
 * Resolve a purchase row's display label from the committed bundle catalog rather than
 * title-casing the raw purchase tag — `textTransform: capitalize` over a bare id like
 * "ai-production" rendered "Ai Production" (CAISSON-69), not the canonical "AI-Production"
 * `BUNDLE_PRICES` carries. `purchaseTag` may be a bare bundle id ("ai-production") or the
 * `_bundle`-suffixed form (`packages/pricebook/src/purchases.ts`'s "ai-production_bundle") — strip
 * the suffix before matching. Falls back to the raw, underscore-humanized tag for anything else
 * (module/subscription purchase tags — e.g. "field-crypto_module", "credit_pack" — that have no
 * bundle-catalog entry).
 */
function displayLabel(tag: string): string {
  const bundleId = tag.endsWith("_bundle")
    ? tag.slice(0, -"_bundle".length)
    : tag;
  const canonical = BUNDLE_PRICES.find((b) => b.id === bundleId)?.label;
  if (canonical !== undefined) return canonical;
  const humanized = tag.replace(/_/g, " ");
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}

export interface PlanPurchaseRowProps {
  priceId: string;
  accountId: string;
  label: string;
  /** True when every entitlement this price grants is already active for the account. */
  owned: boolean;
  /** Rendered next to "Owned" (only ever shown when `owned` is true) — the G14 cancel control on a
   *  subscription row. Purchases never pass this (a one-time buy has nothing to cancel). */
  ownedExtra?: ReactNode;
}

/** One purchasable row on the Plan view: opens the Paddle.js overlay for `priceId`, stamping the
 * verified `accountId` as `custom_data` so the webhook resolves the tenant (ADR-0116). */
export function PlanPurchaseRow({
  priceId,
  accountId,
  label,
  owned,
  ownedExtra,
}: PlanPurchaseRowProps) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isPaddleConfigured();

  async function buy() {
    setOpening(true);
    setError(null);
    try {
      await openCheckout({ priceId, accountId });
    } catch {
      // IN-02: getPaddle() (G6) can now reject on a load/init failure instead of silently
      // poisoning the session — surface it instead of letting the button just revert with no
      // explanation, mirroring cart-checkout-panel.tsx's catch.
      setError(
        "Checkout failed to load — check your connection or ad-blocker, then try again.",
      );
    } finally {
      setOpening(false);
    }
  }

  return (
    <Card>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--cs-space-4)",
          flexWrap: "wrap",
        }}
      >
        <span className="cs-card-title">{displayLabel(label)}</span>
        {owned ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--cs-space-3)",
            }}
          >
            <span
              className="cs-muted"
              style={{ fontSize: "var(--cs-text-sm)" }}
            >
              Owned
            </span>
            {ownedExtra}
          </div>
        ) : (
          <Button
            type="button"
            variant="primary"
            disabled={!configured || opening}
            onClick={() => void buy()}
          >
            {!configured
              ? "Checkout unavailable"
              : opening
                ? "Opening…"
                : "Buy"}
          </Button>
        )}
      </div>
      {error !== null && (
        <p
          className="cs-footnote"
          style={{ color: "var(--cs-danger)", marginTop: "var(--cs-space-2)" }}
        >
          {error}
        </p>
      )}
    </Card>
  );
}
