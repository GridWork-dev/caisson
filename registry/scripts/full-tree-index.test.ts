// Full-tree backfill coherence (ADR-0021/0069/0111). After the publish-readiness backfill grew the
// ledger from the initial 7 seed modules to the full publishable set, the COMMITTED registry/index.json
// must still be an exact, deterministic rebuild from registry/ledger.jsonl — and carry no duplicate
// id@version. This is the same invariant the CI `registry-index` job enforces with `git diff
// --exit-code`; pinning it as a test catches a hand-edited or stale index before CI. Reads the real
// committed files (no fixtures).
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  INDEX_PATH,
  LEDGER_PATH,
  buildIndexFromLedgerFile,
  parseLedger,
} from "./build-index";

describe("full-tree registry backfill (ADR-0021/0111)", () => {
  test("committed index.json is a byte-identical rebuild from the ledger", () => {
    const committed = readFileSync(INDEX_PATH, "utf8");
    const rebuilt = buildIndexFromLedgerFile(LEDGER_PATH);
    expect(rebuilt).toBe(committed);
  });

  test("the ledger carries no duplicate id@version", () => {
    const entries = parseLedger(readFileSync(LEDGER_PATH, "utf8"));
    const seen = new Set<string>();
    const dups: string[] = [];
    for (const e of entries) {
      const key = `${e.id}@${e.version}`;
      if (seen.has(key)) dups.push(key);
      seen.add(key);
    }
    expect(dups).toEqual([]);
  });

  test("the index spans the full publishable set at the second members-fold republish versions", () => {
    const index = JSON.parse(readFileSync(INDEX_PATH, "utf8")) as {
      modules: { id: string; latest: string }[];
    };
    expect(index.modules.length).toBeGreaterThanOrEqual(20);
    // The 2026-07-02 second-wave consume (members-fold republish, MF-A): every published module
    // took at least a patch bump off the ADR-0208 first-wave baseline (0.2.0→0.2.1 / 0.1.1→0.1.2)
    // via `updateInternalDependencies: "patch"` cascade; seven packages with a direct minor
    // changeset (or a minor-bumped dependency) took 0.2.0/0.1.x straight to 0.3.0. Mirrors the
    // divergence map in tooling/standards-gate/src/publish-config.test.ts.
    const MINOR_BUMP = new Set([
      "@caisson/ai-meter",
      "@caisson/billing",
      "@caisson/credits",
      "@caisson/guardrails",
      "@caisson/kernel",
      "@caisson/pricebook",
      "@caisson/tenancy-rls",
    ]);
    const PATCH_ONLY = new Set([
      "@caisson/alerting",
      "@caisson/retention-runner",
      "@caisson/tool-exec",
      "@caisson/platform-reads",
    ]);
    // First publishes AFTER the first republish enter at their own initial version, then cascade
    // like everything else on later waves (mirrors the FIRST_PUBLISH map in
    // tooling/standards-gate/src/publish-config.test.ts).
    const FIRST_PUBLISH: Record<string, string> = {
      // Slice-2 harvest (ADR-0186): published 0.1.0 after the first wave, cascaded to 0.1.1 here
      // (depends on @caisson/kernel, which took this wave's minor bump).
      "@caisson/agent-runner": "0.1.1",
    };
    for (const m of index.modules) {
      expect(m.latest).toBe(
        FIRST_PUBLISH[m.id] ??
          (MINOR_BUMP.has(m.id)
            ? "0.3.0"
            : PATCH_ONLY.has(m.id)
              ? "0.1.2"
              : "0.2.1"),
      );
    }
  });

  test("every ledger module id is @caisson/-scoped and semver-versioned", () => {
    const entries = parseLedger(readFileSync(LEDGER_PATH, "utf8"));
    for (const e of entries) {
      expect(e.id).toMatch(/^@caisson\/[a-z0-9-]+$/);
      expect(e.version).toMatch(/^\d+\.\d+\.\d+/);
    }
  });

  test("edition member versions pin to real published versions (never the 0.0.0 sentinel)", () => {
    const entries = parseLedger(readFileSync(LEDGER_PATH, "utf8"));
    // Every (id, version) pair ever published — the truth a `members` snapshot must agree with.
    // Set-membership rather than latest-only: once the ledger carries more than one release
    // (ADR-0208 republish), an OLDER edition entry legitimately pins the member versions that
    // were current at ITS publish. What can never appear is a pair that was never published —
    // which still catches the "0.0.0" sentinel and unpublished-version drift (the gap that let
    // three editions ship 0.0.0 member pins through CI — ADR-0111/0077).
    const publishedPairs = new Set(entries.map((e) => `${e.id}@${e.version}`));
    const stale: string[] = [];
    for (const e of entries) {
      const members = e.manifest?.members;
      if (!members) continue;
      for (const [memberId, version] of Object.entries(members)) {
        if (!publishedPairs.has(`${memberId}@${version}`)) {
          stale.push(`${e.id} → ${memberId}@${version}`);
        }
      }
    }
    expect(stale).toEqual([]);
  });
});
