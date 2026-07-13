// The intel replay + live-brief eval lane (CAISSON-101/102, ADR-0286). It runs only through this
// service's `eval` script, on GitHub-hosted credentialed compute. Watcher replay is deterministic and
// network-closed; brief composition + actionability judging are live OpenRouter calls and fail closed.
//
// ── The session-4 operator contract (how the lane is armed) ──────────────────────────────────────
//   1. Record live, once, with real watcher creds:      bun run src/eval/record.cli.ts
//      → writes services/intel/__cassettes__/<watcher>.json (sanitized; scrub-gated on write).
//   2. Run the live judged lane and require green:       bun run eval:validate
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
  assertRunEligibleForBaseline,
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

    // Threshold + Wilson confidence must clear BEFORE either validation-only or BLESS can pass.
    // Include per-case evidence on a red model score so remediation never needs a debug rerun.
    try {
      assertRunEligibleForBaseline(replayRun);
      assertRunEligibleForBaseline(briefRun);
    } catch (err) {
      throw new Error(
        `intel eval is not baseline-eligible: ${err instanceof Error ? err.message : String(err)}; cases=${JSON.stringify({ replay: replayRun.scoredCases, brief: briefRun.scoredCases })}`,
        { cause: err },
      );
    }

    // An explicit local/operator preflight proves the new dataset green before BLESS without
    // weakening the generic missing-baseline failure. Normal CI never sets this flag.
    if (process.env.INTEL_EVAL_VALIDATE_ONLY === "1") {
      const bless = process.env.BLESS;
      if (
        bless !== undefined &&
        bless !== "" &&
        bless !== "0" &&
        bless.toLowerCase() !== "false"
      ) {
        throw new Error(
          "INTEL_EVAL_VALIDATE_ONLY and BLESS are mutually exclusive",
        );
      }
      return;
    }

    // The regression gate (BLESS unset here): no regression vs the committed baseline, each eval over
    // its threshold, and each scorer's Wilson lower bound above the 0.6 intel floor.
    const gate = gateAgainstBaseline(BASELINE_PATH, [replayRun, briefRun]);
    expect(gate.passed).toBe(true);
    expect(gate.blessed).toBe(false);
  },
);
