// Round-trip proof for the REAL Paddle price ids wired this session (ADR-0106/0116): drive the
// WRITER (`parsePaddleEvent`) into the READER (`resolvePlan`/`resolvePurchase`) so the value
// contract is pinned across the seam, not just on each side (the same W2-class trap
// `apply-billing-event.integration.test.ts` guards for the Stripe driver). Pure — no DB; both
// `parsePaddleEvent` and `resolvePlan`/`resolvePurchase` are pure functions over their inputs.
import { describe, expect, test } from "bun:test";
import type { DomainBillingEvent } from "@caisson/billing";
import { parsePaddleEvent } from "@caisson/billing-orchestration";
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
      // A renewal-cycle charge (verified 2026-07-01 origin semantics: web/api = first charge,
      // subscription_recurring = renewal, subscription_charge = mid-cycle one-time — non-granting).
      origin: "subscription_recurring",
      currency_code: "usd",
      items: [{ price: { id: priceId } }],
      details: { totals: { grand_total: "149900" } },
      custom_data: { account_id: "acct_roundtrip" },
    },
  };
}

describe("REAL Paddle one-time price ids round-trip (parsePaddleEvent -> resolvePurchase)", () => {
  // ADR-0270 repointed the four archived-edition + bundle-sentinel rows to canonical bundle ids —
  // a historical sandbox replay now resolves the CANONICAL id, never a dissolved edition id.
  const oneTimeCases: Array<{ priceId: string; entitlements: string[] }> = [
    { priceId: "pri_01kwd76be2eq96kff5nqw236c0", entitlements: ["compliance"] },
    { priceId: "pri_01kwd76bp60acq51mftvpgr42k", entitlements: ["everything"] },
    {
      priceId: "pri_01kwd76c1pgs2csxcj2n0y7vv0",
      entitlements: ["ai-production"],
    },
    {
      priceId: "pri_01kwd76cahy825m14334aqf209",
      entitlements: ["local-first"],
    },
    {
      priceId: "pri_01kwd76ck3w8myy4p4f1gj0dcy",
      entitlements: ["agentic-dev"],
    },
    {
      priceId: "pri_01ky0fgqdwpf6yaxzeef03q88e",
      entitlements: ["access-review"],
    },
    {
      priceId: "pri_01ky0fgqk5d855hfjdngjrvj89",
      entitlements: ["risk-register"],
    },
    {
      priceId: "pri_01ky0fgqqzmfbm2406q4rys44e",
      entitlements: ["trust-page"],
    },
  ];

  for (const { priceId, entitlements } of oneTimeCases) {
    test(`${priceId} parses to purchase.completed and resolves`, () => {
      const ev = parsePaddleEvent(
        oneTimeTransactionCompleted(priceId),
      ) as DomainBillingEvent;
      expect(ev.type).toBe("purchase.completed");
      if (ev.type !== "purchase.completed") throw new Error("unreachable");
      expect(ev.lineItems).toEqual([
        { priceId, quantity: 1, itemId: "", chargedAmount: 0 },
      ]);
      const entry = resolvePurchase(priceId);
      expect(entry.entitlements).toEqual(entitlements);
      expect<number>(entry.credits).toBe(0);
    });
  }
});

describe("per-module à-la-carte PLACEHOLDER ids round-trip (parsePaddleEvent -> resolvePurchase)", () => {
  // P6-store track: every commercial module sellable individually (ADR-0071 entitlement infra).
  // These are PLACEHOLDER price ids (real Paddle one-time price ids land at go-live wiring, same
  // posture as the credit-pack / compliance-onetime placeholders above) — proves the writer
  // (parsePaddleEvent) -> reader (resolvePurchase) seam holds for the bare-slug entitlement-id
  // convention the same way it holds for the REAL edition ids above.
  // The four edition-core module rows (compliance/ai-kit/local-ai/agent-dev) were DROPPED
  // (ADR-0238) — their PLACEHOLDER + REAL rows are gone from PURCHASE_BOOK and the retired ids
  // fail resolvePurchase closed (asserted below).
  const moduleCases: Array<{ priceId: string; entitlement: string }> = [
    {
      priceId: "price_field_crypto_module_PLACEHOLDER",
      entitlement: "field-crypto",
    },
    {
      priceId: "price_audit_worm_module_PLACEHOLDER",
      entitlement: "audit-worm",
    },
    { priceId: "price_ai_meter_module_PLACEHOLDER", entitlement: "ai-meter" },
    { priceId: "price_ai_evals_module_PLACEHOLDER", entitlement: "ai-evals" },
    {
      priceId: "price_guardrails_module_PLACEHOLDER",
      entitlement: "guardrails",
    },
    {
      priceId: "price_prompt_registry_module_PLACEHOLDER",
      entitlement: "prompt-registry",
    },
    {
      priceId: "price_local_store_module_PLACEHOLDER",
      entitlement: "local-store",
    },
    {
      priceId: "price_agent_kernel_module_PLACEHOLDER",
      entitlement: "agent-kernel",
    },
    // alerting + retention-runner: the PURCHASE_BOOK row + Paddle round-trip resolve fine. Both are
    // now published in the registry index (ADR-0150/0151) — no longer in
    // RESERVED_MODULE_ENTITLEMENT_IDS — so expansion resolves their bare slug to the real grant.
    { priceId: "price_alerting_module_PLACEHOLDER", entitlement: "alerting" },
    {
      priceId: "price_retention_runner_module_PLACEHOLDER",
      entitlement: "retention-runner",
    },
  ];

  for (const { priceId, entitlement } of moduleCases) {
    test(`${priceId} parses to purchase.completed and resolves`, () => {
      const ev = parsePaddleEvent(
        oneTimeTransactionCompleted(priceId),
      ) as DomainBillingEvent;
      expect(ev.type).toBe("purchase.completed");
      if (ev.type !== "purchase.completed") throw new Error("unreachable");
      expect(ev.lineItems).toEqual([
        { priceId, quantity: 1, itemId: "", chargedAmount: 0 },
      ]);
      const entry = resolvePurchase(priceId);
      expect(entry.entitlements).toEqual([entitlement]);
      expect<number>(entry.credits).toBe(0);
    });
  }

  // A webhook for a retired edition-core price id (a stale sandbox re-delivery) must fail closed
  // at resolvePurchase — never grant, never fall through to an edition expansion (ADR-0238).
  const retiredIds = [
    "price_compliance_module_PLACEHOLDER",
    "price_ai_kit_module_PLACEHOLDER",
    "price_local_ai_module_PLACEHOLDER",
    "price_agent_dev_module_PLACEHOLDER",
    "pri_01kwj6m31fxw5vn532h5ft6780",
    "pri_01kwj6m55yagz7188qer0pa0cd",
    "pri_01kwj6m5mzyn76b8jkknmjndb4",
    "pri_01kwj6m6cbtsh6n5b1bxtb2j0k",
  ];
  for (const priceId of retiredIds) {
    test(`retired ${priceId} still parses but fails resolvePurchase closed`, () => {
      const ev = parsePaddleEvent(
        oneTimeTransactionCompleted(priceId),
      ) as DomainBillingEvent;
      expect(ev.type).toBe("purchase.completed");
      expect(() => resolvePurchase(priceId)).toThrow();
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
      // origin "subscription_recurring" (a renewal) → the cycle reason (2026-07-01 verified
      // origin semantics); both create + cycle sit in the grant gate's GRANTING_REASONS.
      expect(ev.billingReason).toBe("subscription_cycle");
      const entry = resolvePlan(ev.priceId);
      expect(entry.entitlements).toEqual(entitlements);
      expect<number>(entry.creditsPerCycle).toBe(creditsPerCycle);
      expect(entry.cadence).toBe("year");
    });
  }
});
