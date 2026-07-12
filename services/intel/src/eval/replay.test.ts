// End-to-end replay test — the always-run proof that the whole harness reproduces a recorded run and
// that both eval runs gate green, driven off a HANDCRAFTED fixture cassette (never a real one). The
// fixture deliberately lives OUTSIDE __cassettes__ (in src/eval/__fixtures__) so the eval lane's
// skipIf discovery can never pick it up — asserted below. This is what keeps the branch meaningfully
// tested end-to-end with zero committed cassettes.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { gateAgainstBaseline } from "@caisson/ai-evals";
import { readCassetteFile } from "./cassette.ts";
import {
  buildBriefQualityRun,
  buildReplayRun,
  discoverCassettes,
  replayWatcher,
} from "./harness.ts";
import { stableSerialize } from "./rubric.ts";
import type { ReplayEntry } from "./harness.ts";

const FIXTURE = join(
  import.meta.dir,
  "__fixtures__",
  "competitor.fixture.json",
);

describe("intel replay E2E over the handcrafted competitor fixture", () => {
  test("the fixture is invisible to the eval lane's cassette discovery", () => {
    // On this branch there are no committed cassettes, so discovery is empty; and even once an
    // operator adds real ones, the fixture (a different directory) must never appear.
    expect(
      discoverCassettes().some((p) => p.includes("competitor.fixture")),
    ).toBe(false);
  });

  test("the real competitor watcher reproduces the fixture's recorded findings byte-for-byte", async () => {
    const cassette = readCassetteFile(FIXTURE);
    const replayed = await replayWatcher(cassette);
    expect(replayed).toHaveLength(cassette.findings.length);
    // Order-independent, boundary-validated equality of the whole finding set.
    const recorded = cassette.findings.map(stableSerialize).sort();
    const got = replayed.map(stableSerialize).sort();
    expect(got).toEqual(recorded);
  });

  test("both eval runs pass and gate against a BLESS-minted baseline (then non-BLESS)", async () => {
    const cassette = readCassetteFile(FIXTURE);
    const findings = await replayWatcher(cassette);
    const entries: ReplayEntry[] = [{ cassette, findings }];

    const replayRun = await buildReplayRun(entries);
    const briefRun = await buildBriefQualityRun(entries);
    expect(replayRun.passed).toBe(true);
    expect(briefRun.passed).toBe(true);

    const baseline = join(
      mkdtempSync(join(tmpdir(), "intel-eval-")),
      "baseline.json",
    );

    // Mint under BLESS (the sole sanctioned re-baseline path), then restore BLESS exactly — a leaked
    // BLESS=1 would turn every other eval in this process into a silent re-baseline.
    const prevBless = process.env.BLESS;
    process.env.BLESS = "1";
    try {
      const minted = gateAgainstBaseline(baseline, [replayRun, briefRun]);
      expect(minted.blessed).toBe(true);
      expect(minted.passed).toBe(true);
    } finally {
      if (prevBless === undefined) delete process.env.BLESS;
      else process.env.BLESS = prevBless;
    }

    // Non-BLESS gate against the just-minted baseline — proves no regression AND that the 8-finding
    // fixture clears the 0.6 Wilson floor on every scorer (a 1-finding sample would not).
    const gate = gateAgainstBaseline(baseline, [replayRun, briefRun]);
    expect(gate.passed).toBe(true);
    expect(gate.blessed).toBe(false);
  });
});
