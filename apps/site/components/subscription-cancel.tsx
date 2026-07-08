"use client";

import { useState } from "react";
import { Button, ConfirmDialog, StatusPill } from "@caisson/ui/components";

export interface SubscriptionCancelControlProps {
  subscriptionId: string;
}

/**
 * The G14 self-serve cancel control (ADR-0293): a confirm-gated button that POSTs
 * /api/subscription/cancel. The subscription STAYS active after a successful call — Paddle
 * schedules cancellation for the end of the current billing period, and the app's own record only
 * flips once the `subscription.canceled` webhook lands (ADR-0293 binding: never revoke locally on
 * click). This component therefore renders a transient "scheduled" acknowledgement from the
 * mutation's own response rather than a persisted state — on the NEXT page load the row still reads
 * "Owned" (correctly: access continues through the paid period).
 */
export function SubscriptionCancelControl({
  subscriptionId,
}: SubscriptionCancelControlProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<
    | { kind: "scheduled"; effectiveAt: string | null }
    | { kind: "error"; message: string }
    | null
  >(null);

  async function confirmCancel() {
    setBusy(true);
    try {
      const res = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId }),
      });
      const data = (await res.json()) as {
        effectiveAt?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setOutcome({
          kind: "error",
          message: data.error ?? "Could not cancel — try again.",
        });
      } else {
        setOutcome({
          kind: "scheduled",
          effectiveAt: data.effectiveAt ?? null,
        });
      }
    } catch {
      setOutcome({ kind: "error", message: "Could not reach the server." });
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  if (outcome?.kind === "scheduled") {
    return (
      <StatusPill status="pending">
        {outcome.effectiveAt
          ? `Cancels ${outcome.effectiveAt.slice(0, 10)}`
          : "Cancellation scheduled"}
      </StatusPill>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setOutcome(null);
          setConfirmOpen(true);
        }}
      >
        Cancel
      </Button>
      {outcome?.kind === "error" ? (
        <span
          className="cs-muted"
          style={{ fontSize: "var(--cs-text-xs)", color: "var(--cs-danger)" }}
        >
          {outcome.message}
        </span>
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        title="Cancel subscription?"
        message="Your access continues until the end of the current billing period, then this plan ends. This does not refund the current period."
        confirmLabel="Cancel subscription"
        tone="danger"
        busy={busy}
        onConfirm={() => void confirmCancel()}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
