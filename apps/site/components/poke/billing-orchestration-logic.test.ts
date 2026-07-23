// Parity for the billing-orchestration poke's mirror (ADR-0378 lock 2). No __golden__ fixture dir ships
// in packages/billing-orchestration, so the pin is against the REAL package functions: this test drives
// @caisson/billing-orchestration's processEvent / withIdempotentSideEffect against a real PGlite RLS
// harness under bun (pg + tenant GUC + ON CONFLICT all resolve here, unlike the browser bundle the poke
// ships in) and asserts the in-memory mirror produces identical outcomes on the same delivery sequences.
// It also pins the DomainBillingEvent type list against @caisson/billing's DomainBillingEventSchema and
// the ValidationError shape against @caisson/kernel.
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
import { ValidationError } from "@caisson/kernel";
import { DomainBillingEventSchema } from "@caisson/billing";
import {
  PROCESSED_EVENT_SCHEMA_SQL,
  processEvent,
  withIdempotentSideEffect,
} from "@caisson/billing-orchestration";
import { type TestPg, newTestPg } from "@caisson/testing";

import {
  DOMAIN_BILLING_EVENT_TYPES,
  PROVIDERS,
  ValidationErrorMirror,
  assertValidSourceEventId,
  dedupedCount,
  initConsole,
  processEventStep,
  withIdempotentSideEffectStep,
  type Delivery,
  type DomainBillingEventType,
  type ProviderId,
} from "./billing-orchestration-logic";

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

describe("DomainBillingEvent type-list parity vs the real schema", () => {
  test("the poke's type list is the schema's discriminated-union options, in order", () => {
    const options = DomainBillingEventSchema.options as ReadonlyArray<{
      shape: { type: { value: DomainBillingEventType } };
    }>;
    const realTypes = options.map((o) => o.shape.type.value);
    expect([...DOMAIN_BILLING_EVENT_TYPES]).toEqual(realTypes);
  });

  test("every provider emits a subset of the canonical types, and only Paddle emits chargeback", () => {
    const canonical = new Set<string>(DOMAIN_BILLING_EVENT_TYPES);
    for (const p of PROVIDERS) {
      for (const t of p.types) expect(canonical.has(t)).toBe(true);
    }
    const emitsChargeback = PROVIDERS.filter((p) =>
      p.types.includes("chargeback.detected"),
    ).map((p) => p.id);
    expect(emitsChargeback).toEqual(["paddle"]);
  });

  test("Paddle and Stripe sample ids are colon-free; LemonSqueezy and Polar are type:id composites", () => {
    const colonFree: ProviderId[] = ["paddle", "stripe"];
    const composite: ProviderId[] = ["lemonsqueezy", "polar"];
    for (const p of PROVIDERS) {
      const hasColon = p.sampleEventId.includes(":");
      if (colonFree.includes(p.id)) expect(hasColon).toBe(false);
      if (composite.includes(p.id)) expect(hasColon).toBe(true);
    }
  });
});

describe("ValidationErrorMirror shape parity vs @caisson/kernel ValidationError", () => {
  test("name, code, and httpStatus match; the empty-key message is verbatim", () => {
    const real = new ValidationError(
      "processEvent requires a non-empty sourceEventId",
    );
    const mirror = new ValidationErrorMirror(
      "processEvent requires a non-empty sourceEventId",
    );
    expect(mirror.name).toBe(real.name);
    expect(mirror.code).toBe(real.code);
    expect(mirror.httpStatus).toBe(real.httpStatus);
    expect(mirror.message).toBe(real.message);
  });
});

// Drive the real processEvent under one tenant, tracking how many times the grant fn actually ran, and
// return the per-delivery {alreadyProcessed} plus the total fn-run count.
async function runRealSequence(
  account: string,
  ids: string[],
): Promise<{ alreadyProcessed: boolean[]; runs: number }> {
  let runs = 0;
  const alreadyProcessed: boolean[] = [];
  for (const id of ids) {
    const res = await tp.asTenant(account, (tx) =>
      processEvent(tx, id, async () => {
        runs += 1;
      }),
    );
    alreadyProcessed.push(res.alreadyProcessed);
  }
  return { alreadyProcessed, runs };
}

// Replay the same id sequence through the in-memory mirror as a single provider's deliveries.
function runMirrorSequence(ids: string[]): {
  alreadyProcessed: boolean[];
  runs: number;
  deduped: number;
} {
  let state = initConsole();
  const alreadyProcessed: boolean[] = [];
  for (const id of ids) {
    const delivery: Delivery = {
      provider: "paddle",
      type: "purchase.completed",
      sourceEventId: id,
    };
    const stepped = processEventStep(state, delivery);
    state = stepped.state;
    alreadyProcessed.push(stepped.result.alreadyProcessed);
  }
  return {
    alreadyProcessed,
    runs: state.ledger.length,
    deduped: dedupedCount(state),
  };
}

describe("processEvent outer-claim parity: real PGlite vs the in-memory mirror", () => {
  test("deliver then redeliver the same id: fulfilled once, second skipped", async () => {
    const ids = ["evt_dup", "evt_dup"];
    const real = await runRealSequence("acct_dup", ids);
    const mirror = runMirrorSequence(ids);
    expect(mirror.alreadyProcessed).toEqual(real.alreadyProcessed);
    expect(mirror.alreadyProcessed).toEqual([false, true]);
    expect(mirror.runs).toBe(real.runs);
    expect(mirror.runs).toBe(1);
    expect(mirror.deduped).toBe(1);
  });

  test("a mixed sequence of fresh + repeated ids dedupes identically", async () => {
    const ids = ["evt_a", "evt_b", "evt_a", "evt_c", "evt_b", "evt_a"];
    const real = await runRealSequence("acct_mixed", ids);
    const mirror = runMirrorSequence(ids);
    expect(mirror.alreadyProcessed).toEqual(real.alreadyProcessed);
    expect(mirror.alreadyProcessed).toEqual([
      false,
      false,
      true,
      false,
      true,
      true,
    ]);
    expect(mirror.runs).toBe(real.runs);
    expect(mirror.runs).toBe(3);
    expect(mirror.deduped).toBe(3);
  });

  test("distinct ids claim independently (no false dedup)", async () => {
    const ids = ["evt_x", "evt_y", "evt_z"];
    const real = await runRealSequence("acct_distinct", ids);
    const mirror = runMirrorSequence(ids);
    expect(mirror.alreadyProcessed).toEqual(real.alreadyProcessed);
    expect(mirror.runs).toBe(real.runs);
    expect(mirror.runs).toBe(3);
    expect(mirror.deduped).toBe(0);
  });
});

describe("fail-closed guard parity: real processEvent vs the mirror", () => {
  test("an empty sourceEventId is rejected by both", async () => {
    await expect(
      tp.asTenant("acct_empty", (tx) => processEvent(tx, "", async () => {})),
    ).rejects.toThrow(ValidationError);
    expect(() => assertValidSourceEventId("", "processEvent")).toThrow(
      ValidationErrorMirror,
    );
  });

  test("a colon-bearing sourceEventId (the LemonSqueezy/Polar composite shape) is rejected by both", async () => {
    // The real guard throws with an em-dash message; assert only the typed shape, not that string.
    await expect(
      tp.asTenant("acct_colon", (tx) =>
        processEvent(tx, "orders:2481", async () => {}),
      ),
    ).rejects.toThrow(ValidationError);

    let caught: unknown;
    try {
      assertValidSourceEventId("orders:2481", "processEvent");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ValidationErrorMirror);
    const mirror = caught as ValidationErrorMirror;
    expect(mirror.name).toBe("ValidationError");
    expect(mirror.code).toBe("validation_error");
    expect(mirror.httpStatus).toBe(400);
  });

  test("the seeded LemonSqueezy and Polar sample ids both trip the colon guard", () => {
    for (const p of PROVIDERS) {
      if (!p.sampleEventId.includes(":")) continue;
      expect(() =>
        processEventStep(initConsole(), {
          provider: p.id,
          type: "purchase.completed",
          sourceEventId: p.sampleEventId,
        }),
      ).toThrow(ValidationErrorMirror);
    }
  });
});

describe("withIdempotentSideEffect per-effect parity: real PGlite vs the mirror", () => {
  test("two effects of one event both fire once; a redelivery fires neither", async () => {
    const evt = "evt_effects";
    const realFirst = await tp.asTenant("acct_eff", async (tx) => ({
      a: await withIdempotentSideEffect(tx, evt, "discord", async () => {}),
      b: await withIdempotentSideEffect(tx, evt, "email", async () => {}),
    }));
    const realSecond = await tp.asTenant("acct_eff", async (tx) => ({
      a: await withIdempotentSideEffect(tx, evt, "discord", async () => {}),
      b: await withIdempotentSideEffect(tx, evt, "email", async () => {}),
    }));

    let state = initConsole();
    const m1a = withIdempotentSideEffectStep(state, evt, "discord");
    state = m1a.state;
    const m1b = withIdempotentSideEffectStep(state, evt, "email");
    state = m1b.state;
    const m2a = withIdempotentSideEffectStep(state, evt, "discord");
    state = m2a.state;
    const m2b = withIdempotentSideEffectStep(state, evt, "email");

    expect({ a: m1a.fired, b: m1b.fired }).toEqual(realFirst);
    expect({ a: m2a.fired, b: m2b.fired }).toEqual(realSecond);
    expect({ a: m1a.fired, b: m1b.fired }).toEqual({ a: true, b: true });
    expect({ a: m2a.fired, b: m2b.fired }).toEqual({ a: false, b: false });
  });

  test("an empty side-effect name is rejected by both", async () => {
    await expect(
      tp.asTenant("acct_eff2", (tx) =>
        withIdempotentSideEffect(tx, "evt", "", async () => {}),
      ),
    ).rejects.toThrow(ValidationError);
    expect(() =>
      withIdempotentSideEffectStep(initConsole(), "evt", ""),
    ).toThrow(ValidationErrorMirror);
  });
});

describe("mirror self-check (runnable, no DB)", () => {
  test("deduped count = deliveries minus unique fulfillments", () => {
    let state = initConsole();
    for (const id of ["evt_1", "evt_1", "evt_2", "evt_1"]) {
      state = processEventStep(state, {
        provider: "stripe",
        type: "invoice.paid",
        sourceEventId: id,
      }).state;
    }
    expect(state.deliveries).toBe(4);
    expect(state.ledger.length).toBe(2);
    expect(dedupedCount(state)).toBe(2);
  });
});
