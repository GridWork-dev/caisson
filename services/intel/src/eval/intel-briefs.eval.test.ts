// The intel judged-replay eval lane (CAISSON-101, ADR-0286). Joins the repo's turbo `eval` task via
// the `eval` script in package.json; on a main push (or when services/intel/** changed on a PR) it
// runs the two pooled replay evals against the committed baseline. It is offline + deterministic by
// construction — no live model, no network, no secret — exactly like the ai-evals + guardrails lanes.
//
// SELF-SKIPS with zero cassettes (mirrors live/watchers.live.test.ts's opt-in gate): recording is a
// post-merge OPERATOR act, so THIS branch commits NO cassettes and the lane skips green.
//
// ── The session-4 operator contract (how the lane is armed) ──────────────────────────────────────
//   1. Record live, once, with real creds + the judge:  bun run src/eval/record.cli.ts
//      → writes services/intel/__cassettes__/<watcher>.json (sanitized; scrub-gated on write).
//   2. Mint the baseline from the just-recorded runs:    BLESS=1 bun run eval
//      → writes services/intel/__evals__/baseline.json.  Review the diff.
//   3. Commit BOTH the cassettes and the baseline in the same change.
//   4. ASSERT THE LANE ACTUALLY EXECUTES (non-skipped). A skipIf path mismatch is indistinguishable
//      from a green pass — a mis-placed cassette dir would let this file "pass" while grading nothing.
//      After committing, confirm `bun test ./src/eval/intel-briefs.eval.test.ts` reports the case as
//      RUN, not skipped, before trusting the gate.
import { expect, test } from "bun:test";
import { gateAgainstBaseline } from "@caisson/ai-evals";
import { readCassetteFile } from "./cassette.ts";
import {
  BASELINE_PATH,
  buildBriefQualityRun,
  buildReplayRun,
  discoverCassettes,
  replayWatcher,
} from "./harness.ts";
import type { ReplayEntry } from "./harness.ts";

const cassettePaths = discoverCassettes();

// The skipIf convention (ADR-0201): zero cassettes ⇒ the whole lane skips rather than fails. This is
// what keeps the feature branch green while recording stays a post-merge operator act.
const evalTest = test.skipIf(cassettePaths.length === 0);

evalTest(
  "intel judged replay: findings + briefs gate against the committed baseline",
  async () => {
    const entries: ReplayEntry[] = [];
    for (const path of cassettePaths) {
      const cassette = readCassetteFile(path);
      const findings = await replayWatcher(cassette);
      entries.push({ cassette, findings });
    }

    const replayRun = await buildReplayRun(entries);
    const briefRun = await buildBriefQualityRun(entries);

    // The runs must clear their own thresholds before the baseline even matters.
    expect(replayRun.passed).toBe(true);
    expect(briefRun.passed).toBe(true);

    // The regression gate (BLESS unset here): no regression vs the committed baseline, each eval over
    // its threshold, and each scorer's Wilson lower bound above the 0.6 intel floor.
    const gate = gateAgainstBaseline(BASELINE_PATH, [replayRun, briefRun]);
    expect(gate.passed).toBe(true);
    expect(gate.blessed).toBe(false);
  },
);
