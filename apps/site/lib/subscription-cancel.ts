// The G14 cancel orchestration (ADR-0293): verify the caller's account actually owns the ACTIVE
// subscription id it asked to cancel (never trust a caller-supplied id blind — a buyer could
// otherwise probe/cancel another tenant's subscription by guessing its Paddle id), then call Paddle.
// Deliberately takes no DB handle / grant-store import: this module NEVER mutates
// entitlement_grant / subscription_status — cancellation truth arrives only via the
// `subscription.canceled` webhook (ADR-0293 binding). Deps are injected so the orchestration is
// unit-testable without a real DB or network call.
import type { CancelResult } from "./paddle-cancel.ts";
import type { SubscriptionStatusRow } from "./dashboard-reads.ts";

export interface CancelSubscriptionDeps {
  readStatuses: (accountId: string) => Promise<SubscriptionStatusRow[]>;
  cancelPaddle: (subscriptionId: string) => Promise<CancelResult>;
}

export type CancelOutcome =
  | { ok: true; status: string; effectiveAt: string | null }
  | { ok: false; httpStatus: 404 | 502; reason: string };

export async function cancelSubscriptionForAccount(
  accountId: string,
  subscriptionId: string,
  deps: CancelSubscriptionDeps,
): Promise<CancelOutcome> {
  const statuses = await deps.readStatuses(accountId);
  const owned = statuses.some(
    (s) => s.subscriptionId === subscriptionId && s.status === "active",
  );
  if (!owned) {
    return { ok: false, httpStatus: 404, reason: "subscription not found" };
  }
  const result = await deps.cancelPaddle(subscriptionId);
  if (!result.ok) {
    return { ok: false, httpStatus: 502, reason: result.reason };
  }
  return { ok: true, status: result.status, effectiveAt: result.effectiveAt };
}
