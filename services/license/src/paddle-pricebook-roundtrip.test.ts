// Round-trip proof for the REAL Paddle price ids wired this session (ADR-0106/0116): drive the
// WRITER (`parsePaddleEvent`) into the READER (`resolvePlan`/`resolvePurchase`) so the value
// contract is pinned across the seam, not just on each side (the same W2-class trap
// `apply-billing-event.integration.test.ts` guards for the Stripe driver). Pure — no DB; both
// `parsePaddleEvent` and `resolvePlan`/`resolvePurchase` are pure functions over their inputs.
import { describe, expect, test } from "bun:test";
import type { DomainBillingEvent } from "@caisson/billing";
import { parsePaddleEvent } from "@caisson/billing";
import { resolvePlan, resolvePurchase } from "@caisson/pricebook";

function oneTimeTransactionCompleted(
  priceId: string,
): Parameters<typeof parsePaddleEvent>[0] {
  return {
    event_id: `evt_${priceId}`,
    event_type: "transaction.completed",
    data: {
      id: `txn_${priceId}`,
      currency_code: "usd",
      items: [{ price: { id: priceId } }],
      details: { totals: { grand_total: "249900" } },
      custom_data: { account_id: "acct_roundtrip" },
    },
  };
}

function subscriptionTransactionCompleted(
  priceId: string,
): Parameters<typeof parsePaddleEvent>[0] {
  return {
    event_id: `evt_${priceId}`,
    event_type: "transaction.completed",
    data: {
      id: `txn_${priceId}`,
      subscription_id: "sub_roundtrip",
      origin: "subscription_charge",
      currency_code: "usd",
      items: [{ price: { id: priceId } }],
      details: { totals: { grand_total: "149900" } },
      custom_data: { account_id: "acct_roundtrip" },
    },
  };
}

describe("REAL Paddle one-time price ids round-trip (parsePaddleEvent -> resolvePurchase)", () => {
  const oneTimeCases: Array<{ priceId: string; entitlements: string[] }> = [
    { priceId: "pri_01kwd76be2eq96kff5nqw236c0", entitlements: ["compliance"] },
    { priceId: "pri_01kwd76bp60acq51mftvpgr42k", entitlements: ["bundle"] },
    { priceId: "pri_01kwd76c1pgs2csxcj2n0y7vv0", entitlements: ["ai-kit"] },
    { priceId: "pri_01kwd76cahy825m14334aqf209", entitlements: ["local-ai"] },
    { priceId: "pri_01kwd76ck3w8myy4p4f1gj0dcy", entitlements: ["agent-dev"] },
  ];

  for (const { priceId, entitlements } of oneTimeCases) {
    test(`${priceId} parses to purchase.completed and resolves`, () => {
      const ev = parsePaddleEvent(
        oneTimeTransactionCompleted(priceId),
      ) as DomainBillingEvent;
      expect(ev.type).toBe("purchase.completed");
      if (ev.type !== "purchase.completed") throw new Error("unreachable");
      expect(ev.priceId).toBe(priceId);
      const entry = resolvePurchase(ev.priceId);
      expect(entry.entitlements).toEqual(entitlements);
      expect(entry.credits).toBe(0);
    });
  }
});

describe("REAL Paddle subscription price ids round-trip (parsePaddleEvent -> resolvePlan)", () => {
  const planCases: Array<{
    priceId: string;
    entitlements: string[];
    creditsPerCycle: number;
  }> = [
    {
      priceId: "pri_01kwd76d64rz2ecm090pt4nq5q",
      entitlements: [],
      creditsPerCycle: 1000,
    },
    {
      priceId: "pri_01kwd76cwytyyy4yhd9ch0m935",
      entitlements: ["compliance"],
      creditsPerCycle: 12000,
    },
  ];

  for (const { priceId, entitlements, creditsPerCycle } of planCases) {
    test(`${priceId} parses to invoice.paid (annual cadence) and resolves`, () => {
      const ev = parsePaddleEvent(
        subscriptionTransactionCompleted(priceId),
      ) as DomainBillingEvent;
      expect(ev.type).toBe("invoice.paid");
      if (ev.type !== "invoice.paid") throw new Error("unreachable");
      expect(ev.priceId).toBe(priceId);
      expect(ev.billingReason).toBe("subscription_create");
      const entry = resolvePlan(ev.priceId);
      expect(entry.entitlements).toEqual(entitlements);
      expect(entry.creditsPerCycle).toBe(creditsPerCycle);
      expect(entry.cadence).toBe("year");
    });
  }
});
