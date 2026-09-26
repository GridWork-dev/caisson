// The ai-meter poke's checkable claims, now that it drives the REAL @caisson-sh/ai-meter and the
// hand-ported mirror (ai-meter-logic.ts) is deleted:
//
//   1. The poke's client graph is browser-safe — proven by a STATIC SOURCE-GRAPH WALK, never by a
//      build (a bundler does not fail on a node builtin, it SUBSTITUTES a ~428KB polyfill, exit 0).
//   2. The DB-bound money path — reserve/reconcile, the stored breaker, the DDL, tenancy-rls and
//      the credit ledger — is unreachable from the client entry.
//   3. Every credit figure on screen is the package's own: the golden fixture reproduces through
//      the poke, not through a restated cost table.
//   4. The poke's model list and its key grammar are the real bundled book's, not a copy.
//   5. The 402 the poke shows is the package's own SpendCapError, thrown on the same ordering the
//      package documents (breaker first, debit before spend, settle exactly once).
//
// The walk follows the `bun` (src) condition of each package's exports map; Next resolves
// `exports.default -> dist`. tscn is a per-file emit (no bundling, no re-export rewriting), so the
// dist module graph is the src module graph — CI builds packages before the site consumes them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  nodeBuiltinTaint,
  nodeGlobalTaint,
} from "@caisson-sh/testing/module-graph";
import {
  BUNDLED_PRICE_BOOK,
  CREDIT_CONVERSION,
  PRICE_BOOK_VERSION,
  SpendCapError,
  computeCost,
  creditsForMicroUsd,
  priceKey,
  resolvePriceEntry,
} from "@caisson-sh/ai-meter";

import {
  GOLDEN_USAGE,
  MODEL_KEYS,
  applyReconcile,
  applyReserve,
  applyResetBreaker,
  entryFor,
  initSession,
  runaway,
  splitModelKey,
} from "./ai-meter-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "ai-meter-poke.tsx");
const SAMPLE_MODEL = "openai/gpt-4o-mini";

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
    // Guard the guard: files.length alone proves nothing. These two are reachable ONLY through
    // @caisson-sh/ai-meter/browser's own imports — first hop (the package), then a second hop across
    // the kernel seam — so a resolver gone blind inside a workspace package fails here.
    expect(walk.files).toContain("packages/ai-meter/src/token-rates.ts");
    expect(walk.files).toContain("packages/kernel/src/schema.ts");
  });

  test("the DB-bound money path never reaches the client entry", () => {
    for (const server of ["meter.ts", "breaker.ts", "schema.ts"]) {
      expect(walk.files).not.toContain(`packages/ai-meter/src/${server}`);
    }
    expect(walk.files.some((f) => f.startsWith("packages/tenancy-rls/"))).toBe(
      false,
    );
    expect(walk.files.some((f) => f.startsWith("packages/credits/"))).toBe(
      false,
    );
    expect(
      walk.files
        .filter((file) => file.startsWith("packages/ai-meter/src/"))
        .sort(),
    ).toEqual([
      "packages/ai-meter/src/browser.ts",
      "packages/ai-meter/src/contracts.ts",
      "packages/ai-meter/src/estimate.ts",
      "packages/ai-meter/src/token-rates.ts",
    ]);
  });

  test("the poke imports the ./browser entry, never the node-capable barrel", () => {
    // The specifier itself is pinned: `@caisson-sh/ai-meter` (bare) would walk clean today only by
    // accident of what the barrel happens to re-export, and it does not — it reaches node:crypto.
    const src = readFileSync(POKE_ENTRY, "utf8");
    expect(src).toMatch(/from "@caisson-sh\/ai-meter\/browser";$/m);
    expect(src).not.toMatch(/from "@caisson-sh\/ai-meter";$/m);
  });

  test("the unwalked external frontier is exactly the known browser-safe set", () => {
    // A new entry here means a non-workspace dependency joined the client graph — that is a review
    // event, not a silent hole in the proof.
    expect(walk.external).toEqual(["react", "zod"]);
  });

  test("positive control: the same walker reports real builtins on the ai-meter barrel", () => {
    const tainted = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/ai-meter/src/index.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(
      tainted.offenders.some(
        (o) =>
          o.file.endsWith("ai-meter/src/meter.ts") && o.spec === "node:crypto",
      ),
    ).toBe(true);
  });
});

describe("the poke's model list and key grammar are the real book's", () => {
  test("MODEL_KEYS is exactly the bundled price book's key set", () => {
    expect(MODEL_KEYS).toEqual(Object.keys(BUNDLED_PRICE_BOOK));
    expect(MODEL_KEYS.length).toBeGreaterThan(0);
  });

  test("splitModelKey round-trips every key through the package's own priceKey", () => {
    for (const key of MODEL_KEYS) {
      const { provider, model } = splitModelKey(key);
      expect(priceKey(provider, model)).toBe(key);
    }
  });

  test("entryFor returns the package's own entry for every listed model", () => {
    for (const key of MODEL_KEYS) {
      const { provider, model } = splitModelKey(key);
      expect(entryFor(key)).toBe(
        resolvePriceEntry(BUNDLED_PRICE_BOOK, provider, model),
      );
    }
  });

  test("entryFor fails closed on an unknown model — never a zero-rate meter", () => {
    expect(() => entryFor("nope/nope")).toThrow();
    expect(() => entryFor("no-slash")).toThrow();
  });
});

describe("the poke reproduces the package's shipped cost golden", () => {
  const goldenSchema = z.object({
    creditConversion: z.object({
      microUsdPerCredit: z.number().int().positive(),
    }),
    cases: z.array(
      z.object({
        name: z.string(),
        provider: z.string(),
        model: z.string(),
        usage: z.object({
          inputTokens: z.number().int(),
          cachedInputTokens: z.number().int(),
          outputTokens: z.number().int(),
        }),
        expected: z.object({
          costMicroUsd: z.number().int(),
          credits: z.number().int(),
        }),
      }),
    ),
  });

  const golden = goldenSchema.parse(
    JSON.parse(
      readFileSync(
        join(WORKSPACE_ROOT, "packages/ai-meter/src/__golden__/cost.json"),
        "utf8",
      ),
    ),
  );

  // `expect<number>(...)` on every branded receiver, the same widening @caisson-sh/kernel's own
  // money.test.ts uses: the package's money values carry MicroUsd/Credits/MicroUsdPerCredit brands,
  // the golden fixture is plain parsed JSON, and bun:test infers the matcher's type from the
  // receiver. Without the widening this file is six tsc errors that `bun test` cannot see.
  test("the conversion the poke meters through is the shipped one", () => {
    expect<number>(CREDIT_CONVERSION.microUsdPerCredit).toBe(
      golden.creditConversion.microUsdPerCredit,
    );
  });

  test.each(golden.cases.map((c) => [c.name, c] as const))(
    "%s: the poke's entry lookup + the real computeCost hit the fixture exactly",
    (_name, c) => {
      const cost = computeCost(
        c.usage,
        entryFor(priceKey(c.provider, c.model)),
        CREDIT_CONVERSION,
      );
      expect<number>(cost.costMicroUsd).toBe(c.expected.costMicroUsd);
      expect<number>(cost.credits).toBe(c.expected.credits);
      expect<number>(
        creditsForMicroUsd(cost.costMicroUsd, CREDIT_CONVERSION),
      ).toBe(c.expected.credits);
    },
  );

  test("GOLDEN_USAGE is the fixture's openai-partial-cache case, priced at 1680 micro-USD / 2 credits", () => {
    const fixtureCase = golden.cases.find(
      (c) => c.name === "openai-partial-cache",
    );
    expect(fixtureCase?.usage).toEqual(GOLDEN_USAGE);
    const cost = computeCost(
      GOLDEN_USAGE,
      entryFor(SAMPLE_MODEL),
      CREDIT_CONVERSION,
    );
    expect<number>(cost.costMicroUsd).toBe(1680);
    expect<number>(cost.credits).toBe(2);
  });

  test("the poke's chrome label carries the package's own price-book version", () => {
    expect(readFileSync(POKE_ENTRY, "utf8")).toContain("${PRICE_BOOK_VERSION}");
    expect(PRICE_BOOK_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("the sample session ledger holds the package's documented ordering", () => {
  test("debit-before-spend: reserve lands a feature_debit row sized by the real estimate", () => {
    const session = initSession(500, 5, 3);
    const { session: next, result } = applyReserve(session, SAMPLE_MODEL, 2000);
    expect(result.reservedCredits).toBeGreaterThan(0);
    expect(next.wallet).toBe(500 - result.reservedCredits);
    expect(next.ledger[0]?.kind).toBe("feature_debit");
    expect(next.ledger[0]?.credits).toBe(result.reservedCredits);
    // Integer credits only (ADR-0007) — a float here would be the money bug the poke exists to show.
    expect(Number.isInteger(result.reservedCredits)).toBe(true);
  });

  test("reconcile with nothing pending returns null", () => {
    expect(applyReconcile(initSession(500, 5, 3))).toBeNull();
  });

  test("reconcile trues up to the golden actual and settles idempotently on a second call", () => {
    const { session: reserved } = applyReserve(
      initSession(500, 50, 30),
      SAMPLE_MODEL,
      2000,
    );
    const first = applyReconcile(reserved);
    expect(first).not.toBeNull();
    if (first === null) return;
    expect(first.result.idempotent).toBe(false);
    expect(first.result.actualCredits).toBe(2);

    const second = applyReconcile(first.session);
    expect(second).not.toBeNull();
    if (second === null) return;
    expect(second.result.idempotent).toBe(true);
    // Settles once: no second ledger row, no second wallet move.
    expect(second.session.wallet).toBe(first.session.wallet);
    expect(second.session.ledger.length).toBe(first.session.ledger.length);
  });

  test("runaway trips the breaker at the hard cap, then the NEXT reserve carries the real 402", () => {
    const { session: next, outcome } = runaway(
      initSession(500, 5, 3),
      SAMPLE_MODEL,
      2000,
    );
    expect(outcome.trippedAtIteration).not.toBeNull();
    expect(next.breaker).toBe("open");
    // The code/status are read off the package's own SpendCapError, not restated here.
    expect(outcome.blocked?.code).toBe("spend_cap_reached");
    expect(outcome.blocked?.httpStatus).toBe(402);
    expect(() => applyReserve(next, SAMPLE_MODEL, 2000)).toThrow(SpendCapError);
  });

  test("resetBreaker is the only way back: reserves resume after it, never before", () => {
    const { session: tripped } = runaway(
      initSession(500, 5, 3),
      SAMPLE_MODEL,
      2000,
    );
    expect(tripped.breaker).toBe("open");
    const reset = applyResetBreaker(tripped);
    expect(reset.breaker).toBe("closed");
    expect(() => applyReserve(reset, SAMPLE_MODEL, 2000)).not.toThrow();
  });
});
