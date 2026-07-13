// The judged-replay harness (CAISSON-101): the shared machinery that turns a set of cassettes into
// the two pooled `defineEval` runs the eval gate scores. Factored out of the test entry so the
// always-run fixture E2E (replay.test.ts) drives the IDENTICAL code path the operator eval lane
// (intel-briefs.eval.test.ts) runs — no test-only replay branch that could drift from the real one.
//
// Two runs, split by THRESHOLD (see rubric.ts):
//   - intel-replay        (1.0): accuracy + grounding + no-extra-findings, all deterministic.
//   - intel-brief-quality (0.7): live composition + live actionability judge, injected at the edge.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { defineEval, judgeGrader, wilsonLowerBound } from "@caisson/ai-evals";
import type { EvalCase, EvalRun, Grader, Judge } from "@caisson/ai-evals";
import { parseFinding } from "../finding.ts";
import { InMemoryStore } from "../store.ts";
import { findWatcher } from "../watchers/index.ts";
import { buildReplayFetcher, replayConfig } from "./cassette.ts";
import type { IntelCassette } from "./cassette.ts";
import {
  ACTIONABILITY_CRITERIA,
  accuracyGrader,
  groundingGrader,
  noExtraFindingsGrader,
  stableSerialize,
} from "./rubric.ts";
import type { Finding } from "../finding.ts";
import type { Logger } from "../logger.ts";

// Version binding (ADR-0061): every eval dataset is bound to one immutable prompt version. The intel
// briefs "prompt" is the enrichment rubric at services/intel/src/llm.ts + this actionability rubric.
export const REPLAY_EVAL = "intel-replay";
export const BRIEF_EVAL = "intel-brief-quality";
export const PROMPT_VERSION_ID = "00000000-0000-4000-8000-000000000005";
export const PROMPT_REF = "intel/briefs@caisson-102-live";

// ponytail: 0.6, deliberately BELOW the ai-evals lane's usual 0.8 floor — the session-4 cassette
// sample is small (a handful of findings per watcher). Raise to 0.8 once n>=16 all-passing findings
// across cassettes is proven (wilsonLowerBound(16,16) ≈ 0.80 clears an 0.8 floor).
export const INTEL_WILSON_FLOOR = 0.6;
const REPLAY_THRESHOLD = 1;
const BRIEF_THRESHOLD = 0.7;

// The cassette store (operator-recorded) and the committed baseline both sit at the service root, one
// level above src/. import.meta.dir here is services/intel/src/eval.
export const CASSETTE_DIR = join(import.meta.dir, "..", "..", "__cassettes__");
export const BASELINE_PATH = join(
  import.meta.dir,
  "..",
  "..",
  "__evals__",
  "baseline.json",
);

/** Discover committed cassettes. A missing directory is an empty set and the green-only eval entry
 * stays skipped until a judged dataset is eligible to commit. Sorted for a stable pooled-run order. */
export function discoverCassettes(): string[] {
  try {
    return readdirSync(CASSETTE_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => join(CASSETTE_DIR, f))
      .sort();
  } catch {
    return [];
  }
}

// Replay never logs to the operator's real sinks — a silent logger keeps the eval output clean.
const noop = (): void => undefined;
const silentLogger: Logger = { info: noop, warn: noop, error: noop };

export interface ReplayEntry {
  readonly cassette: IntelCassette;
  /** The findings the REAL watcher produced when re-run against the cassette (what we grade). */
  readonly findings: readonly Finding[];
}

export interface BriefQualityDependencies {
  /** Live brief composer. The eval caller injects a fail-closed implementation. */
  readonly compose: (finding: Finding) => Promise<Finding>;
  /** Live actionability judge. `judgeGrader` re-validates every verdict. */
  readonly judge: Judge;
}

/**
 * Pre-BLESS quality gate. `gateAgainstBaseline` intentionally makes BLESS the sole writer, but its
 * write path does not compare a run to itself. Enforce both absolute threshold and Wilson confidence
 * here so a small/lucky dataset can never become the trusted baseline.
 */
export function assertRunEligibleForBaseline(run: EvalRun): void {
  if (!run.passed) {
    throw new Error(
      `intel eval "${run.name}" failed threshold: score ${String(run.score)} < ${String(run.threshold)}`,
    );
  }
  if (run.wilsonFloor === undefined) return;
  for (const scorer of Object.keys(run.scorers)) {
    const successes = run.scoredCases.filter(
      (scored) => scored.passes[scorer] === true,
    ).length;
    const lowerBound = wilsonLowerBound(successes, run.cases);
    if (lowerBound < run.wilsonFloor) {
      throw new Error(
        `intel eval "${run.name}" scorer "${scorer}" Wilson lower bound ${String(lowerBound)} (successes=${String(successes)}/${String(run.cases)}) is below ${String(run.wilsonFloor)}`,
      );
    }
  }
}

/**
 * Re-run the real watcher named by a cassette against that cassette's recorded world: the recorded
 * config (with dummy creds re-injected), the recorded watch_state seeded into an InMemoryStore, the
 * replay fetcher over the recorded exchanges, and the recorded instant as the clock. Zero network,
 * zero tokens, zero live DB. Returns the findings the watcher detected — byte-reproducible.
 */
export async function replayWatcher(
  cassette: IntelCassette,
): Promise<Finding[]> {
  const watcher = findWatcher(cassette.watcher);
  if (watcher === undefined) {
    throw new Error(`cassette names unknown watcher "${cassette.watcher}"`);
  }
  const store = new InMemoryStore();
  await store.setWatchState(cassette.watchState);
  const recordedAtMs = Date.parse(cassette.recordedAt);
  return watcher.run({
    config: replayConfig(cassette),
    store,
    fetchImpl: buildReplayFetcher(cassette.exchanges),
    now: () => recordedAtMs,
    logger: silentLogger,
  });
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * The deterministic run (threshold 1.0). Cases: one FINDING case per replayed finding (id = its
 * dedupKey, output = the stable-serialized finding) plus one COUNT case per cassette (output = the
 * replayed finding count, expected.recordedCount = the recorded count). accuracy looks up recorded
 * findings by dedupKey across the whole pool; grounding checks against the union of all fetched hosts.
 */
export function buildReplayRun(
  entries: readonly ReplayEntry[],
): Promise<EvalRun> {
  const recorded = entries.flatMap((e) => e.cassette.findings);
  const exchangeHosts = new Set<string>();
  for (const e of entries) {
    for (const ex of e.cassette.exchanges) {
      const host = hostOf(ex.url);
      if (host !== null) exchangeHosts.add(host);
    }
  }
  const cases: EvalCase[] = [];
  for (const e of entries) {
    for (const f of e.findings) {
      cases.push({
        id: f.dedupKey,
        input: { kind: "finding" },
        output: stableSerialize(f),
      });
    }
    cases.push({
      id: `${e.cassette.watcher}:count`,
      input: { kind: "count", watcher: e.cassette.watcher },
      output: String(e.findings.length),
      expected: { recordedCount: e.cassette.findings.length },
    });
  }
  const scorers: Record<string, Grader> = {
    accuracy: accuracyGrader(recorded),
    grounding: groundingGrader(exchangeHosts),
    "no-extra-findings": noExtraFindingsGrader(),
  };
  return defineEval({
    name: REPLAY_EVAL,
    promptVersionId: PROMPT_VERSION_ID,
    promptRef: PROMPT_REF,
    threshold: REPLAY_THRESHOLD,
    wilsonFloor: INTEL_WILSON_FLOOR,
    cases,
    scorers,
  });
}

/**
 * The judged run (threshold 0.7). One case per replayed RAW finding. Each is first passed through the
 * injected live composer, then the rendered brief is scored by the injected live judge. Both seams
 * fail closed: a malformed composition or verdict rejects the run rather than falling back to the
 * raw template notice. The raw cassette remains deterministic and contains no model output.
 */
export async function buildBriefQualityRun(
  entries: readonly ReplayEntry[],
  dependencies: BriefQualityDependencies,
): Promise<EvalRun> {
  const cases: EvalCase[] = [];
  for (const entry of entries) {
    for (const finding of entry.findings) {
      const brief = parseFinding(await dependencies.compose(finding));
      cases.push({
        id: finding.dedupKey,
        input: { kind: "finding", rawFinding: finding },
        output: brief.body,
      });
    }
  }
  return defineEval({
    name: BRIEF_EVAL,
    promptVersionId: PROMPT_VERSION_ID,
    promptRef: PROMPT_REF,
    threshold: BRIEF_THRESHOLD,
    wilsonFloor: INTEL_WILSON_FLOOR,
    cases,
    scorers: {
      actionability: judgeGrader(dependencies.judge, ACTIONABILITY_CRITERIA),
    },
  });
}
