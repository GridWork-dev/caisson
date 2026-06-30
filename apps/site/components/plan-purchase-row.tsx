"use client";

import { useState } from "react";
import { Button, Card } from "@caisson/ui/components";
import { isPaddleConfigured, openCheckout } from "@/lib/paddle-checkout";

export interface PlanPurchaseRowProps {
  priceId: string;
  accountId: string;
  label: string;
  /** True when every entitlement this price grants is already active for the account. */
  owned: boolean;
}

/** One purchasable row on the Plan view: opens the Paddle.js overlay for `priceId`, stamping the
 * verified `accountId` as `custom_data` so the webhook resolves the tenant (ADR-0116). */
export function PlanPurchaseRow({
  priceId,
  accountId,
  label,
  owned,
}: PlanPurchaseRowProps) {
  const [opening, setOpening] = useState(false);
  const configured = isPaddleConfigured();

  async function buy() {
    setOpening(true);
    try {
      await openCheckout({ priceId, accountId });
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
        <span className="cs-card-title" style={{ textTransform: "capitalize" }}>
          {label.replace(/_/g, " ")}
        </span>
        {owned ? (
          <span className="cs-muted" style={{ fontSize: "var(--cs-text-sm)" }}>
            Owned
          </span>
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
    </Card>
  );
}
