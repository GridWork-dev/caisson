// Dual-layer billing-webhook idempotency against a real PGlite (RLS + ON CONFLICT semantics), ADR-0229
// rows 50 + 51. Proves: a fresh claim runs fn once, a re-delivery skips it; per-side-effect claims fire
// each effect once and a re-delivery re-fires neither; empty keys fail closed; a claim without a tenant
// context fails closed on the NOT NULL account_id.
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
import { ValidationError } from "@caisson-sh/kernel";
import { type TestPg, newTestPg } from "@caisson-sh/testing";
import {
  PROCESSED_EVENT_SCHEMA_SQL,
  processEvent,
  withIdempotentSideEffect,
} from "./idempotency.ts";

// The PGlite RLS harness flakes on the 5s default under runner load (the license-suite gotcha).
setDefaultTimeout(30_000);

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(PROCESSED_EVENT_SCHEMA_SQL);
});

afterAll(async () => {
  await tp.close();
});

describe("processEvent (outer webhook-event dedup)", () => {
  test("a fresh claim runs fn; a re-delivery of the same event skips it", async () => {
    const acct = "acct_pe1";
    const evt = "evt_pe1";
    let runs = 0;
    const first = await tp.asTenant(acct, (tx) =>
      processEvent(tx, evt, async () => {
        runs += 1;
      }),
    );
    expect(first).toEqual({ alreadyProcessed: false });

    const second = await tp.asTenant(acct, (tx) =>
      processEvent(tx, evt, async () => {
        runs += 1;
      }),
    );
    expect(second).toEqual({ alreadyProcessed: true });
    expect(runs).toBe(1);
  });

  test("distinct event ids claim independently", async () => {
    const acct = "acct_pe2";
    let runs = 0;
    await tp.asTenant(acct, (tx) =>
      processEvent(tx, "evt_a", async () => {
        runs += 1;
      }),
    );
    await tp.asTenant(acct, (tx) =>
      processEvent(tx, "evt_b", async () => {
        runs += 1;
      }),
    );
    expect(runs).toBe(2);
  });

  test("if fn throws, the claim rolls back with it — the next delivery retries cleanly", async () => {
    const acct = "acct_pe_rollback";
    const evt = "evt_pe_rollback";
    let runs = 0;
    await expect(
      tp.asTenant(acct, (tx) =>
        processEvent(tx, evt, async () => {
          runs += 1;
          throw new Error("grant failed");
        }),
      ),
    ).rejects.toThrow("grant failed");

    // The claim was rolled back with the failed grant, so a retry is NOT treated as already-processed.
    const retry = await tp.asTenant(acct, (tx) =>
      processEvent(tx, evt, async () => {
        runs += 1;
      }),
    );
    expect(retry).toEqual({ alreadyProcessed: false });
    expect(runs).toBe(2);
  });

  test("an empty sourceEventId is rejected (fail closed)", async () => {
    await expect(
      tp.asTenant("acct_pe3", (tx) => processEvent(tx, "", async () => {})),
    ).rejects.toThrow(ValidationError);
  });

  test("a sourceEventId containing ':' is rejected — it would alias a per-effect composite key", async () => {
    await expect(
      tp.asTenant("acct_pe_colon", (tx) =>
        processEvent(tx, "evt:with:colon", async () => {}),
      ),
    ).rejects.toThrow(ValidationError);
    await expect(
      tp.asTenant("acct_pe_colon", (tx) =>
        withIdempotentSideEffect(
          tx,
          "evt:with:colon",
          "discord",
          async () => {},
        ),
      ),
    ).rejects.toThrow(ValidationError);
  });

  test("a claim without a tenant context fails closed (blank account_id refused)", async () => {
    await expect(
      tp.asAppNoTenant((tx) =>
        processEvent(tx, "evt_no_tenant", async () => {}),
      ),
    ).rejects.toThrow();
  });
});

describe("withIdempotentSideEffect (per-side-effect dedup)", () => {
  test("two distinct side-effects of one event both fire once; a re-delivery fires neither", async () => {
    const acct = "acct_se1";
    const evt = "evt_se1";
    const fired: string[] = [];

    const firstDelivery = await tp.asTenant(acct, async (tx) => {
      const a = await withIdempotentSideEffect(tx, evt, "discord", async () => {
        fired.push("discord");
      });
      const b = await withIdempotentSideEffect(tx, evt, "email", async () => {
        fired.push("email");
      });
      return { a, b };
    });
    expect(firstDelivery).toEqual({ a: true, b: true });
    expect([...fired].sort()).toEqual(["discord", "email"]);

    const reDelivery = await tp.asTenant(acct, async (tx) => {
      const a = await withIdempotentSideEffect(tx, evt, "discord", async () => {
        fired.push("discord");
      });
      const b = await withIdempotentSideEffect(tx, evt, "email", async () => {
        fired.push("email");
      });
      return { a, b };
    });
    expect(reDelivery).toEqual({ a: false, b: false });
    // Unchanged — neither effect re-fired on the re-delivery.
    expect([...fired].sort()).toEqual(["discord", "email"]);
  });

  test("the outer event claim and a per-effect claim of the same event do not collide", async () => {
    const acct = "acct_se2";
    const evt = "evt_se2";
    const outer = await tp.asTenant(acct, (tx) =>
      processEvent(tx, evt, async () => {}),
    );
    expect(outer.alreadyProcessed).toBe(false);
    // "evt_se2" vs "evt_se2:x" are distinct rows — the side-effect still claims fresh.
    const effect = await tp.asTenant(acct, (tx) =>
      withIdempotentSideEffect(tx, evt, "x", async () => {}),
    );
    expect(effect).toBe(true);
  });

  test("an empty side-effect name is rejected (fail closed)", async () => {
    await expect(
      tp.asTenant("acct_se3", (tx) =>
        withIdempotentSideEffect(tx, "evt", "", async () => {}),
      ),
    ).rejects.toThrow(ValidationError);
  });
});
