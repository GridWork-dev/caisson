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

  test("the index spans the full publishable set, not just the 7-module seed", () => {
    const index = JSON.parse(readFileSync(INDEX_PATH, "utf8")) as {
      modules: { id: string; latest: string }[];
    };
    expect(index.modules.length).toBeGreaterThanOrEqual(20);
    // Every module advertises 0.1.0 as a published version after the flip.
    for (const m of index.modules) {
      expect(m.latest).toBe("0.1.0");
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
    // The latest published version per module — the truth a `members` snapshot must agree with.
    const published = new Map(entries.map((e) => [e.id, e.version]));
    const stale: string[] = [];
    for (const e of entries) {
      const members = e.manifest?.members;
      if (!members) continue;
      for (const [memberId, version] of Object.entries(members)) {
        // A member must resolve to a real ledger entry at that exact version — catches the
        // never-published "0.0.0" sentinel and any drift from a member's published version (the
        // gap that let three editions ship 0.0.0 member pins through CI — ADR-0111/0077).
        if (published.get(memberId) !== version) {
          stale.push(`${e.id} → ${memberId}@${version}`);
        }
      }
    }
    expect(stale).toEqual([]);
  });
});
