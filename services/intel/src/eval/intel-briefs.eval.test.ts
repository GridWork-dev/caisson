// The intel replay + live-brief eval lane (CAISSON-101/102, ADR-0286). It runs only through this
// service's `eval` script, on GitHub-hosted credentialed compute. Watcher replay is deterministic and
// network-closed; brief composition + actionability judging are live OpenRouter calls and fail closed.
//
// ── The session-4 operator contract (how the lane is armed) ──────────────────────────────────────
//   1. Record live, once, with real watcher creds:      bun run src/eval/record.cli.ts
//      → writes services/intel/__cassettes__/<watcher>.json (sanitized; scrub-gated on write).
//   2. Run the live judged lane and require green:       bun run eval
//   3. Mint only after that green run:                   BLESS=1 bun run eval
//      → writes services/intel/__evals__/baseline.json.  Review the diff.
//   4. Commit BOTH the cassettes and the baseline in the same change.
//   5. ASSERT THE LANE ACTUALLY EXECUTES (non-skipped). A path mismatch is indistinguishable
//      from a green pass — a mis-placed cassette dir would let this file "pass" while grading nothing.
//      After committing, confirm `bun test ./src/eval/intel-briefs.eval.test.ts` reports the case as
//      RUN, not skipped, before trusting the gate.
import { expect, test } from "bun:test";
import { fetchWithTimeout } from "@caisson/kernel";
import { gateAgainstBaseline } from "@caisson/ai-evals";
import { composeFindingBrief } from "../llm.ts";
import { readCassetteFile } from "./cassette.ts";
import {
  BASELINE_PATH,
  buildBriefQualityRun,
  buildReplayRun,
  discoverCassettes,
  replayWatcher,
} from "./harness.ts";
import type { ReplayEntry } from "./harness.ts";
import { createOpenRouterJudge, loadLiveEvalConfig } from "./live-judge.ts";

const cassettePaths = discoverCassettes();

// Green-only dataset discipline: until a live judged recording clears both gates, no cassette is
// committed and a clean checkout skips. Once cassettes land, this becomes a real (non-skipped) run;
// the in-test length assertion catches a path/discovery mismatch.
const evalTest = test.skipIf(cassettePaths.length === 0);

evalTest(
  "intel judged replay: findings + briefs gate against the committed baseline",
  async () => {
    expect(cassettePaths.length).toBeGreaterThan(0);
    const live = loadLiveEvalConfig(process.env);
    const entries: ReplayEntry[] = [];
    for (const path of cassettePaths) {
      const cassette = readCassetteFile(path);
      const findings = await replayWatcher(cassette);
      entries.push({ cassette, findings });
    }

    const replayRun = await buildReplayRun(entries);
    const briefRun = await buildBriefQualityRun(entries, {
      compose: (finding) =>
        composeFindingBrief(
          finding,
          { apiKey: live.apiKey, model: live.composeModel },
          fetchWithTimeout,
        ),
      judge: createOpenRouterJudge(live.apiKey, live.judgeModel),
    });

    // The runs must clear their own thresholds before the baseline even matters. Include compact
    // per-case evidence in a red error so the operator can report the gap without a debug rerun.
    if (!replayRun.passed) {
      throw new Error(
        `intel deterministic replay failed: ${JSON.stringify({ score: replayRun.score, cases: replayRun.scoredCases })}`,
      );
    }
    if (!briefRun.passed) {
      throw new Error(
        `intel live brief quality failed: ${JSON.stringify({ score: briefRun.score, threshold: briefRun.threshold, cases: briefRun.scoredCases })}`,
      );
    }

    // The regression gate (BLESS unset here): no regression vs the committed baseline, each eval over
    // its threshold, and each scorer's Wilson lower bound above the 0.6 intel floor.
    const gate = gateAgainstBaseline(BASELINE_PATH, [replayRun, briefRun]);
    expect(gate.passed).toBe(true);
    expect(gate.blessed).toBe(false);
  },
);
