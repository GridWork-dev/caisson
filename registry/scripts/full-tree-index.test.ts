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

  test("the index spans the full publishable set and every latest matches the ledger's highest version", () => {
    const index = JSON.parse(readFileSync(INDEX_PATH, "utf8")) as {
      modules: { id: string; latest: string }[];
    };
    expect(index.modules.length).toBeGreaterThanOrEqual(20);
    // The old form of this test pinned an exact per-wave version map, which went stale on every
    // consume (the CI publish run bumps versions on main without re-running this suite — the
    // 2026-07-03 third-wave consume broke the ADR-0228 second-wave pins). The durable invariant
    // is wave-independent: each module's `latest` is the semver-highest entry the ledger carries
    // for it. Byte-identical index↔ledger provenance is already pinned by the first test.
    const semverCmp = (a: string, b: string): number => {
      const pa = a.split(/[.-]/).map(Number);
      const pb = b.split(/[.-]/).map(Number);
      for (let i = 0; i < 3; i++) {
        if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
      }
      return 0;
    };
    const highest = new Map<string, string>();
    for (const e of parseLedger(readFileSync(LEDGER_PATH, "utf8"))) {
      const cur = highest.get(e.id);
      if (cur === undefined || semverCmp(e.version, cur) > 0) {
        highest.set(e.id, e.version);
      }
    }
    for (const m of index.modules) {
      expect(m.latest).toBe(highest.get(m.id) ?? "MISSING-FROM-LEDGER");
    }
    // And coverage the other way: every ledgered module appears in the index.
    const indexed = new Set(index.modules.map((m) => m.id));
    for (const id of highest.keys()) {
      expect(indexed.has(id)).toBe(true);
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
    // The ONE sanctioned pre-publish pin: the Everything bundle names @caisson/ui-pro before that
    // package ships (its explicit full-catalog rule is locked; expansion allowlist-guards the grant
    // until ui-pro is indexed). Remove this exemption when ui-pro publishes.
    const sanctionedPhantoms = new Set(["@caisson/ui-pro@0.0.0"]);
    const stale: string[] = [];
    for (const e of entries) {
      const members = e.manifest?.members;
      if (!members) continue;
      for (const [memberId, version] of Object.entries(members)) {
        const pair = `${memberId}@${version}`;
        if (!publishedPairs.has(pair) && !sanctionedPhantoms.has(pair)) {
          stale.push(`${e.id} → ${pair}`);
        }
      }
    }
    expect(stale).toEqual([]);
  });
});
