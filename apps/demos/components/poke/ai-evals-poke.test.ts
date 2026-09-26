// The ai-evals poke's checkable claims, now that it drives the REAL @caisson-sh/ai-evals through its
// `./browser` entry and the hand-ported mirror (ai-evals-logic.ts) is deleted:
//
//   1. The poke's client graph is browser-safe — a STATIC SOURCE-GRAPH WALK, never a build (a
//      bundler does not fail on a node builtin, it SUBSTITUTES a ~428KB polyfill, exit 0).
//   2. The sample run the sliders author is the package's real `EvalRun`, and the real comparator
//      finds the four regression kinds the UI advertises.
//   3. The BLESS path is the package's own merge: WR-01 refuses a below-threshold run, and a
//      blessed run leaves every other eval in the file untouched.
//   4. The comparator is now the FULL one — the opt-in Wilson branch the deleted mirror omitted
//      fires when a run opts in. That gap is what "drive the real package" was for.
//
// The walk follows the `bun` (src) condition of each package's exports map; Next resolves
// `exports.default -> dist`. tscn is a per-file emit (no bundling, no re-export rewriting), so the
// dist module graph is the src module graph — CI builds packages before the site consumes them.
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";
import {
  compareToBaseline,
  mergeIntoBaseline,
  wilsonLowerBound,
} from "@caisson-sh/ai-evals/browser";
import type { BaselineFile, EvalRun } from "@caisson-sh/ai-evals/browser";

import {
  COMMITTED_CASES,
  EVAL_NAME,
  INITIAL_BASELINE,
  SAMPLE_THRESHOLD,
  SHRUNK_CASES,
  sampleRun,
} from "./ai-evals-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "ai-evals-poke.tsx");

/** The slider defaults the component mounts with. */
const AT_REST = { accuracy: 0.85, tone: 0.81, cases: COMMITTED_CASES };

describe("the poke's client graph is browser-safe (static source walk, NOT a build)", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("no module reachable from the client entry imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
  });

  test("no edge was silently skipped — every declined edge would land in `unresolved`", () => {
    expect(walk.unresolved).toEqual([]);
  });

  test("the walk really crossed into the package, past its browser entry", () => {
    // The UI kit alone contributes dozens of files, so files.length can never prove the ai-evals
    // edges resolved. These two are reachable ONLY through @caisson-sh/ai-evals/browser — the entry,
    // then a second hop — so a resolver that went blind inside a workspace package fails here.
    expect(walk.files).toContain("packages/ai-evals/src/browser.ts");
    expect(walk.files).toContain("packages/ai-evals/src/baseline-compare.ts");
    // …and never the node:fs transport half.
    expect(walk.files).not.toContain("packages/ai-evals/src/baseline.ts");
  });

  test("positive control: the walker is not blind — the `.` barrel DOES report offenders", () => {
    const barrel = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/ai-evals/src/index.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(
      barrel.offenders.some((o) => o.file.endsWith("src/baseline.ts")),
    ).toBe(true);
  });
});

describe("the sliders author a real EvalRun the shipped comparator accepts", () => {
  test("at rest the run clears its threshold and the committed baseline", () => {
    const run = sampleRun(AT_REST);
    expect(run.name).toBe(EVAL_NAME);
    expect(run.threshold).toBe(SAMPLE_THRESHOLD);
    expect(run.passed).toBe(true);
    const comparison = compareToBaseline(run, INITIAL_BASELINE);
    expect(comparison.passed).toBe(true);
    expect(comparison.findings).toEqual([]);
    expect(comparison.blessed).toBe(false);
  });

  test("dragging one scorer below its baseline reports scorer-regression, not a silent pass", () => {
    const findings = compareToBaseline(
      sampleRun({ ...AT_REST, tone: 0.7 }),
      INITIAL_BASELINE,
    ).findings;
    expect(findings.map((f) => f.kind)).toContain("scorer-regression");
    expect(findings.find((f) => f.kind === "scorer-regression")?.scorer).toBe(
      "tone",
    );
  });

  test("dragging both scorers under the threshold reports below-threshold too", () => {
    const kinds = compareToBaseline(
      sampleRun({ ...AT_REST, accuracy: 0.6, tone: 0.6 }),
      INITIAL_BASELINE,
    ).findings.map((f) => f.kind);
    expect(kinds).toContain("below-threshold");
    expect(kinds).toContain("score-regression");
  });

  test("the shrunk-dataset checkbox reports fewer-cases — a flattering mean is still flagged", () => {
    const findings = compareToBaseline(
      // A HIGHER mean on FEWER cases: the only finding is the shrink itself.
      sampleRun({ accuracy: 0.95, tone: 0.95, cases: SHRUNK_CASES }),
      INITIAL_BASELINE,
    ).findings;
    expect(findings.map((f) => f.kind)).toEqual(["fewer-cases"]);
    expect(findings[0]?.actual).toBe(SHRUNK_CASES);
    expect(findings[0]?.baseline).toBe(COMMITTED_CASES);
  });

  test("the four kinds the UI advertises are exactly the four this demo can reach", () => {
    // missing-baseline needs an eval absent from the file; wilson-below-floor needs an opted-in
    // floor. Neither is exposed by the component, and the note under the chips says so.
    const empty: BaselineFile = { schemaVersion: 1, evals: {} };
    expect(
      compareToBaseline(sampleRun(AT_REST), empty).findings.map((f) => f.kind),
    ).toEqual(["missing-baseline"]);
  });
});

describe("BLESS is the package's own merge, not a poke-local rewrite", () => {
  test("a below-threshold run is refused before anything merges (WR-01)", () => {
    const failing = sampleRun({ ...AT_REST, accuracy: 0.1, tone: 0.1 });
    expect(() => mergeIntoBaseline(INITIAL_BASELINE, [failing])).toThrow(
      /not baseline-eligible/,
    );
  });

  test("blessing overwrites this eval and leaves every other one untouched", () => {
    const other = "unrelated-eval";
    const existing: BaselineFile = {
      schemaVersion: 1,
      evals: {
        ...INITIAL_BASELINE.evals,
        [other]: { ...INITIAL_BASELINE.evals[EVAL_NAME]!, score: 0.91 },
      },
    };
    const run = sampleRun({ ...AT_REST, accuracy: 0.9, tone: 0.9 });
    const next = mergeIntoBaseline(existing, [run]);
    expect(next.evals[EVAL_NAME]?.score).toBe(run.score);
    expect(next.evals[other]?.score).toBe(0.91);
    // …and the input file is not mutated: the component holds the OLD one until setState lands.
    expect(existing.evals[EVAL_NAME]?.score).toBe(0.83);
  });
});

describe("the comparator is the FULL shipped one, Wilson branch included", () => {
  // The deleted mirror omitted this branch entirely and listed "wilson-below-floor" in its union
  // for type parity only — it could never emit it. The real function can.
  test("an opted-in wilsonFloor emits wilson-below-floor on a lucky small sample", () => {
    const base = sampleRun({ accuracy: 1, tone: 1, cases: COMMITTED_CASES });
    const run: EvalRun = {
      ...base,
      cases: 3,
      wilsonFloor: 0.9,
      scoredCases: [1, 2, 3].map((n) => ({
        caseId: `case-${String(n)}`,
        scores: { accuracy: 1, tone: 1 },
        passes: { accuracy: true, tone: true },
        score: 1,
      })),
    };
    const findings = compareToBaseline(run, {
      schemaVersion: 1,
      evals: {
        [EVAL_NAME]: { ...INITIAL_BASELINE.evals[EVAL_NAME]!, cases: 3 },
      },
    }).findings;
    expect(findings.map((f) => f.kind)).toContain("wilson-below-floor");
    // 3/3 is a perfect score on a tiny sample: the lower bound is well under the 0.9 floor.
    expect(wilsonLowerBound(3, 3)).toBeLessThan(0.9);
  });
});
