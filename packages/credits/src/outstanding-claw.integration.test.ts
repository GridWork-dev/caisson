// outstandingClaw — the read-then-claw TOCTOU guard, on real PGlite + withTenant RLS. Proves the
// arithmetic `outstandingClaw` computes (granted - alreadyClawed, floored at 0) and — the direct
// regression for the bug this closes — that a SECOND, differently-keyed claw attempt against an
// already-fully-clawed purchase reads 0 remaining rather than trusting a stale precomputed amount,
// so it can never spill into an UNRELATED purchase's unspent credits in the same fungible wallet.
//
// PGlite is a single connection (documented in advisory-lock.integration.test.ts) so this cannot
// model true cross-transaction blocking; what it DOES prove is the invariant the lock exists to
// guarantee — the outstanding amount is always re-derived fresh at the point of use, never trusted
// from an earlier read — which is exactly what makes two REAL concurrent transactions safe once the
// advisory lock (proven to be acquired first in outstanding-claw.test.ts) serializes them.
import {
  afterAll,
  beforeEach,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
import { type TestPg, newTestPg } from "@caisson-sh/testing";
import { asCredits } from "@caisson-sh/kernel";
import { withTenant } from "@caisson-sh/tenancy-rls";
import {
  CREDIT_EXPIRY_MIGRATION_SQL,
  CREDIT_LINE_ITEM_MIGRATION_SQL,
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
  GRANT_CONSUMPTION_MIGRATION_SQL,
  balance,
  clawback,
  grant,
  outstandingClaw,
} from "./index.ts";

let tp: TestPg;

async function freshSchema(): Promise<void> {
  await tp.exec(
    `DROP TABLE IF EXISTS grant_consumption; DROP TABLE IF EXISTS credit_expiry_notice; DROP TABLE IF EXISTS credit_event; DROP TABLE IF EXISTS credit_wallet;`,
  );
  await tp.exec(CREDIT_SCHEMA_SQL);
  await tp.exec(CREDIT_ROUNDING_MIGRATION_SQL);
  await tp.exec(CREDIT_LINE_ITEM_MIGRATION_SQL);
  await tp.exec(CREDIT_EXPIRY_MIGRATION_SQL);
  await tp.exec(GRANT_CONSUMPTION_MIGRATION_SQL);
}

beforeEach(async () => {
  if (!tp) tp = await newTestPg();
  await freshSchema();
});

afterAll(async () => {
  await tp.close();
});

async function purchaseGrant(
  acct: string,
  amount: number,
  paymentId: string,
): Promise<void> {
  await withTenant(tp.pg, acct, (tx) =>
    grant(tx, {
      eventType: "purchase",
      accountId: acct,
      amount: asCredits(amount),
      sourceEventId: paymentId,
    }),
  );
}

describe("outstandingClaw (real PGlite)", () => {
  test("returns the full granted amount when nothing has been clawed yet", async () => {
    const acct = "acct_fresh";
    await purchaseGrant(acct, 5000, "p1");
    const remaining = await withTenant(tp.pg, acct, (tx) =>
      outstandingClaw(tx, acct, "p1"),
    );
    expect(remaining).toBe(5000);
  });

  test("nets out a prior claw even when keyed differently (a per-line claw against a whole-purchase read)", async () => {
    const acct = "acct_net";
    // A per-line purchase grant: source_event_id="p1" (the purchase), line_item_id="item1" (the line).
    await withTenant(tp.pg, acct, (tx) =>
      grant(tx, {
        eventType: "purchase",
        accountId: acct,
        amount: asCredits(5000),
        sourceEventId: "p1",
        lineItemId: "item1",
      }),
    );
    // A per-line claw, keyed by the ADR-0218 adjustment:item shape — DIFFERENT from "p1" — but
    // carrying the SAME lineItemId, so creditsClawedForSource's line-item join still finds it.
    await withTenant(tp.pg, acct, (tx) =>
      clawback(tx, {
        accountId: acct,
        amount: 2000,
        sourceEventId: "adj1:item1",
        lineItemId: "item1",
      }),
    );
    const remaining = await withTenant(tp.pg, acct, (tx) =>
      outstandingClaw(tx, acct, "p1"),
    );
    expect(remaining).toBe(3000);
  });

  test("re-derives the bound after a committed claw and clamps at 0 — an exhausted purchase cannot reach an unrelated purchase's credits", async () => {
    const acct = "acct_leak";
    await purchaseGrant(acct, 10_000, "p1"); // purchase 1
    await purchaseGrant(acct, 3_000, "p2"); // purchase 2 — UNRELATED

    // First claw (e.g. the refund webhook's whole-transaction branch for p1).
    const remaining1 = await withTenant(tp.pg, acct, (tx) =>
      outstandingClaw(tx, acct, "p1"),
    );
    expect(remaining1).toBe(10_000);
    await withTenant(tp.pg, acct, (tx) =>
      clawback(tx, {
        accountId: acct,
        amount: remaining1,
        sourceEventId: "p1",
      }),
    );

    // A second, DIFFERENTLY-keyed claw attempt for the SAME purchase p1 (e.g. an admin revoke
    // after the webhook). This SEQUENTIAL run pins the arithmetic bound only — the old unlocked
    // code passes it too, since a committed claw is visible to any later read. The RACE the lock
    // closes (two OVERLAPPING transactions each reading a stale alreadyClawed=0, the second
    // draining p2's credits via the balance clamp) cannot be modeled on single-connection PGlite;
    // the lock's serialization is pinned by the recording-executor ordering tests
    // (outstanding-claw.test.ts: lock-before-read, same key for every caller) alongside this
    // arithmetic pin — the same proof decomposition advisory-lock.integration.test.ts documents.
    const remaining2 = await withTenant(tp.pg, acct, (tx) =>
      outstandingClaw(tx, acct, "p1"),
    );
    expect(remaining2).toBe(0);

    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(3_000); // p2's credits are completely untouched
  });

  test("bounds the outstanding amount at 0 even if claws exceed the recorded grant (never negative)", async () => {
    const acct = "acct_over";
    await purchaseGrant(acct, 1_000, "p1");
    await withTenant(tp.pg, acct, (tx) =>
      clawback(tx, { accountId: acct, amount: 1_000, sourceEventId: "p1" }),
    );
    const remaining = await withTenant(tp.pg, acct, (tx) =>
      outstandingClaw(tx, acct, "p1"),
    );
    expect(remaining).toBe(0);
  });
});
