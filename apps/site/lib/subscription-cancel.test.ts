// ADR-0293 G14: ownership-check + Paddle-call orchestration. `CancelSubscriptionDeps` carries only a
// READ (`readStatuses`) and the Paddle call (`cancelPaddle`) — there is no grant-mutation dependency
// to inject, which is itself the proof this module cannot touch entitlement_grant/subscription_status
// locally; cancellation truth arrives only via the webhook (ADR-0293 binding).
import { expect, test } from "bun:test";
import type { SubscriptionStatusRow } from "./dashboard-reads.ts";
import { cancelSubscriptionForAccount } from "./subscription-cancel.ts";

function statusRow(
  overrides: Partial<SubscriptionStatusRow> = {},
): SubscriptionStatusRow {
  return {
    subscriptionId: "sub_1",
    priceId: "pri_dev",
    planTag: "developer",
    status: "active",
    updatedAt: "2026-07-07T00:00:00.000Z",
    ...overrides,
  };
}

test("cancels an owned, active subscription and returns Paddle's scheduled-change result", async () => {
  let calledWith: string | undefined;
  const outcome = await cancelSubscriptionForAccount("acct_1", "sub_1", {
    readStatuses: async () => [statusRow()],
    cancelPaddle: async (subscriptionId) => {
      calledWith = subscriptionId;
      return {
        ok: true,
        status: "active",
        effectiveAt: "2026-08-01T00:00:00.000Z",
      };
    },
  });
  expect(calledWith).toBe("sub_1");
  expect(outcome).toEqual({
    ok: true,
    status: "active",
    effectiveAt: "2026-08-01T00:00:00.000Z",
  });
});

test("404s on a subscription id the account does not own — never calls Paddle", async () => {
  let paddleCalled = false;
  const outcome = await cancelSubscriptionForAccount("acct_1", "sub_other", {
    readStatuses: async () => [statusRow({ subscriptionId: "sub_1" })],
    cancelPaddle: async () => {
      paddleCalled = true;
      return { ok: true, status: "active", effectiveAt: null };
    },
  });
  expect(paddleCalled).toBe(false);
  expect(outcome).toEqual({
    ok: false,
    httpStatus: 404,
    reason: "subscription not found",
  });
});

test("404s on an ALREADY-canceled subscription — cancel is not idempotently retryable through this route", async () => {
  const outcome = await cancelSubscriptionForAccount("acct_1", "sub_1", {
    readStatuses: async () => [statusRow({ status: "canceled" })],
    cancelPaddle: async () => ({
      ok: true,
      status: "canceled",
      effectiveAt: null,
    }),
  });
  expect(outcome.ok).toBe(false);
});

test("a Paddle failure surfaces as a 502, never mutates anything locally", async () => {
  const outcome = await cancelSubscriptionForAccount("acct_1", "sub_1", {
    readStatuses: async () => [statusRow()],
    cancelPaddle: async () => ({
      ok: false,
      reason: "Paddle returned status 500",
    }),
  });
  expect(outcome).toEqual({
    ok: false,
    httpStatus: 502,
    reason: "Paddle returned status 500",
  });
});
