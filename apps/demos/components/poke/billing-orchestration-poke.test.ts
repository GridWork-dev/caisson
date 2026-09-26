// The billing-orchestration poke's checkable claims, now that it drives the REAL package and the
// hand-ported mirror (billing-orchestration-logic.ts) is deleted:
//
//   1. The poke's client graph is browser-safe — proven by a STATIC SOURCE-GRAPH WALK, never by a
//      build (a bundler does not fail on a node builtin, it SUBSTITUTES a ~428KB polyfill, exit 0).
//      This poke is the sharpest case for that rule: the package's `.` barrel reaches node:crypto
//      through @caisson-sh/billing's signature verifiers and `pg` through @caisson-sh/tenancy-rls, so the
//      `/browser` subpath is load-bearing and the specifier itself is pinned below.
//   2. The claim-key decision is the package's, not a copy: the poke's step function rejects a blank
//      and a colon-bearing key by throwing the shipped @caisson-sh/kernel ValidationError. Be honest
//      about how that is proven — comparing the thrown message to the shipped guard's own output
//      cannot fail while the poke delegates, so it catches only a REWORDED re-inline; the re-inline
//      that copy-pastes a message byte for byte is caught instead by the source bans below, which
//      cover both of the guard's messages and constructing the error at all. What the poke DOES
//      author is the em-dash normalization those words pass through on the way to the screen
//      (`verdictProse`, ADR-0375 lock 1), pinned here too.
//   3. The chip vocabulary is presentation, pinned against @caisson-sh/billing's real
//      DomainBillingEventSchema (this test runs under bun, so it may import the node-capable barrel).
//   4. The in-memory claim table is a PORT, not a second implementation: it is replayed against the
//      REAL processEvent on a real PGlite RLS harness (pg + tenant GUC + ON CONFLICT all resolve
//      here, unlike the browser bundle the poke ships in) and must agree sequence for sequence.
//
// The walk follows the `bun` (src) condition of each package's exports map; Next resolves
// `exports.default -> dist`. tscn is a per-file emit (no bundling, no re-export rewriting), so the
// dist module graph is the src module graph — CI builds packages before the site consumes them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
import {
  nodeBuiltinTaint,
  nodeGlobalTaint,
} from "@caisson-sh/testing/module-graph";
import { ValidationError } from "@caisson-sh/kernel";
import { DomainBillingEventSchema } from "@caisson-sh/billing";
import {
  PROCESSED_EVENT_SCHEMA_SQL,
  assertValidSourceEventId,
  processEvent,
} from "@caisson-sh/billing-orchestration";
import { type TestPg, newTestPg } from "@caisson-sh/testing";

import {
  DOMAIN_BILLING_EVENT_TYPES,
  GATED_SIDE_EFFECT,
  PROVIDERS,
  dedupedCount,
  initConsole,
  processEventStep,
  verdictProse,
  type ConsoleState,
  type Delivery,
  type DomainBillingEventType,
  type ProviderId,
} from "./billing-orchestration-poke";

// The PGlite RLS harness flakes on the 5s default under runner load (the license-suite gotcha).
setDefaultTimeout(30_000);

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "billing-orchestration-poke.tsx");

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(PROCESSED_EVENT_SCHEMA_SQL);
});

afterAll(async () => {
  await tp.close();
});

describe("the poke's client graph is browser-safe (static source walk, NOT a build)", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("no module reachable from the client entry imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
  });

  test("no edge was silently skipped — every declined edge would land in `unresolved`", () => {
    expect(walk.unresolved).toEqual([]);
  });

  test("no package or poke module introduces an untracked node global", () => {
    expect(
      nodeGlobalTaint(walk.files, { workspaceRoot: WORKSPACE_ROOT }),
    ).toEqual([{ file: "packages/kernel/src/config.ts", spec: "process" }]);
  });

  test("the walk really crossed into the package, past the first hop", () => {
    // Guard the guard: the UI kit alone contributes dozens of files, so files.length can never
    // prove the billing-orchestration edges resolved. event-keys.ts is reachable only through
    // @caisson-sh/billing-orchestration/browser, and kernel's errors.ts only through event-keys.ts —
    // first hop, then second hop, so a resolver gone blind inside a workspace package fails here.
    expect(walk.files).toContain(
      "packages/billing-orchestration/src/event-keys.ts",
    );
    expect(walk.files).toContain("packages/kernel/src/errors.ts");
    expect(
      walk.files
        .filter((file) =>
          file.startsWith("packages/billing-orchestration/src/"),
        )
        .sort(),
    ).toEqual([
      "packages/billing-orchestration/src/browser.ts",
      "packages/billing-orchestration/src/event-keys.ts",
    ]);
  });

  test("the server-only half of the package never enters the client graph", () => {
    expect(walk.files).not.toContain(
      "packages/billing-orchestration/src/idempotency.ts",
    );
    expect(walk.files).not.toContain(
      "packages/billing-orchestration/src/index.ts",
    );
    expect(walk.files.some((f) => f.startsWith("packages/tenancy-rls/"))).toBe(
      false,
    );
    expect(walk.files.some((f) => f.startsWith("packages/billing/"))).toBe(
      false,
    );
  });

  test("the import specifier is the /browser subpath, and @caisson-sh/billing is type-only", () => {
    // The subpath is the whole proof — importing the barrel instead would drag the verifiers and
    // pg into the bundle graph, so pin the specifier in source, not just the walk result.
    const src = readFileSync(POKE_ENTRY, "utf8");
    expect(src).toMatch(
      /^import \{ assertValidSourceEventId \} from "@caisson-sh\/billing-orchestration\/browser";$/m,
    );
    expect(src).not.toMatch(/from "@caisson-sh\/billing-orchestration";$/m);
    // The erasure claim is checked, not assumed: the DomainBillingEvent import exists in source as
    // the STATEMENT-LEVEL `import type` form (compiler-guaranteed erasure under
    // verbatimModuleSyntax), and the inline `import { type X }` form — which the walker
    // deliberately reports as a value edge — is affirmatively absent.
    expect(src).toMatch(
      /^import type \{[^}]*\} from "@caisson-sh\/billing";$/m,
    );
    expect(src).not.toMatch(
      /^import \{[^}]*\btype\b[^}]*\} from "@caisson-sh\/billing";$/m,
    );
  });

  test("the unwalked external frontier is exactly the known browser-safe set", () => {
    // A new entry here means a new non-workspace dependency joined the client graph — that is a
    // review event, not a silent hole in the proof.
    expect(walk.external).toEqual(["react", "zod"]);
  });

  test("positive control: the same walker reports real builtins on the package barrel", () => {
    const tainted = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/billing-orchestration/src/index.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(
      tainted.offenders.some(
        (o) => o.file === "packages/billing/src/webhook.ts",
      ),
    ).toBe(true);
  });
});

describe("the chip vocabulary is pinned to the real schema", () => {
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

describe("the claim-key decision is the package's, not a copy", () => {
  function reject(sourceEventId: string, state = initConsole()): unknown {
    try {
      processEventStep(state, {
        provider: "paddle",
        type: "purchase.completed",
        sourceEventId,
      });
      return null;
    } catch (err: unknown) {
      return err;
    }
  }

  function packageMessage(sourceEventId: string): string {
    try {
      assertValidSourceEventId(sourceEventId, "processEvent");
      throw new Error("expected the package guard to reject");
    } catch (err: unknown) {
      if (!(err instanceof ValidationError)) throw err;
      return err.message;
    }
  }

  test.each([
    ["a blank key", ""],
    ["a colon-bearing key", "orders:2481"],
  ])(
    "%s throws the shipped ValidationError with the package's own message",
    (_name, id) => {
      const err = reject(id);
      if (!(err instanceof ValidationError)) {
        throw new Error("expected a ValidationError");
      }
      expect(err.code).toBe("validation_error");
      expect(err.httpStatus).toBe(400);
      // Equality against the guard's own output cannot fail while the poke delegates — it is the
      // reworded-re-inline tripwire, not the whole proof. The byte-identical re-inline is banned in
      // source below.
      expect(err.message).toBe(packageMessage(id));
    },
  );

  test("the rendered verdict keeps the package's words but drops the em-dash clause break", () => {
    // ADR-0375 lock 1 binds buyer-facing shipped prose, and both composite-key providers seed a
    // colon-bearing sample id, so this is the FIRST click on the LemonSqueezy and Polar tabs, not an
    // edge path. The positive control is the point: it proves verdictProse is doing work rather than
    // passing a string that never had a dash in it.
    const colon = packageMessage("orders:2481");
    expect(colon).toContain("—");

    const rendered = verdictProse(colon);
    expect(rendered).not.toContain("—");
    expect(rendered).toContain("requires a sourceEventId without ':'");
    expect(rendered).toContain(
      "it would alias the composite side-effect key namespace",
    );

    // A message with no clause break passes through untouched.
    const blank = packageMessage("");
    expect(verdictProse(blank)).toBe(blank);
  });

  test("a rejected delivery leaves the console the component still holds untouched", () => {
    // The rejected calls get THIS state object, so a step that claimed or counted in place before
    // the guard threw would show up as a claimed key or a bumped delivery count here. (The happy
    // path returns a NEW state, which is why the component can keep using this one after a throw.)
    const state = processEventStep(initConsole(), {
      provider: "paddle",
      type: "purchase.completed",
      sourceEventId: "evt_ok",
    }).state;
    const snapshot = structuredClone(state);
    expect(reject("", state)).toBeInstanceOf(ValidationError);
    expect(reject("orders:2481", state)).toBeInstanceOf(ValidationError);
    expect(state).toEqual(snapshot);
  });

  test("the poke does not restate the guard's rules", () => {
    // A future edit that re-inlines the colon/blank checks in the component fails here. BOTH of the
    // guard's messages are banned, not just the blank one: the colon rule is the load-bearing half
    // (it governs the LemonSqueezy/Polar composite-key shape), and a byte-identical copy of its
    // message is the one re-inline the message-equality assertion above cannot see. Minting the
    // error is banned outright too — the component only ever CATCHES a ValidationError.
    const src = readFileSync(POKE_ENTRY, "utf8");
    expect(src).not.toMatch(/requires a non-empty sourceEventId/);
    expect(src).not.toMatch(/requires a sourceEventId without/);
    expect(src).not.toMatch(/alias the composite side-effect key namespace/);
    expect(src).not.toMatch(/new ValidationError\(/);
    expect(src).not.toMatch(/class \w*ValidationError/);
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

// Replay the same id sequence through the poke's in-memory port as one provider's deliveries.
function runPortSequence(ids: string[]): {
  alreadyProcessed: boolean[];
  runs: number;
  deduped: number;
} {
  let state: ConsoleState = initConsole();
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

describe("the in-memory claim table is a port: real PGlite vs the poke's console", () => {
  test("deliver then redeliver the same id: fulfilled once, second skipped", async () => {
    const ids = ["evt_dup", "evt_dup"];
    const real = await runRealSequence("acct_dup", ids);
    const port = runPortSequence(ids);
    expect(port.alreadyProcessed).toEqual(real.alreadyProcessed);
    expect(port.alreadyProcessed).toEqual([false, true]);
    expect(port.runs).toBe(real.runs);
    expect(port.runs).toBe(1);
    expect(port.deduped).toBe(1);
  });

  test("a mixed sequence of fresh + repeated ids dedupes identically", async () => {
    const ids = ["evt_a", "evt_b", "evt_a", "evt_c", "evt_b", "evt_a"];
    const real = await runRealSequence("acct_mixed", ids);
    const port = runPortSequence(ids);
    expect(port.alreadyProcessed).toEqual(real.alreadyProcessed);
    expect(port.alreadyProcessed).toEqual([
      false,
      false,
      true,
      false,
      true,
      true,
    ]);
    expect(port.runs).toBe(real.runs);
    expect(port.runs).toBe(3);
    expect(port.deduped).toBe(3);
  });

  test("distinct ids claim independently (no false dedup)", async () => {
    const ids = ["evt_x", "evt_y", "evt_z"];
    const real = await runRealSequence("acct_distinct", ids);
    const port = runPortSequence(ids);
    expect(port.alreadyProcessed).toEqual(real.alreadyProcessed);
    expect(port.runs).toBe(real.runs);
    expect(port.runs).toBe(3);
    expect(port.deduped).toBe(0);
  });

  test("the real processEvent rejects the same keys the poke's guard does", async () => {
    await expect(
      tp.asTenant("acct_empty", (tx) => processEvent(tx, "", async () => {})),
    ).rejects.toThrow(ValidationError);
    await expect(
      tp.asTenant("acct_colon", (tx) =>
        processEvent(tx, "orders:2481", async () => {}),
      ),
    ).rejects.toThrow(ValidationError);
  });

  test("every fulfillment records the gated side-effect the outer claim exists for", () => {
    const { state } = processEventStep(initConsole(), {
      provider: "paddle",
      type: "purchase.completed",
      sourceEventId: "evt_side",
    });
    expect(state.ledger[0]?.sideEffect).toBe(GATED_SIDE_EFFECT);
  });
});
