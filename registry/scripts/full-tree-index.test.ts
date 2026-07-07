// Full-tree backfill coherence (ADR-0021/0069/0111). After the publish-readiness backfill grew the
// ledger from the initial 7 seed modules to the full publishable set, the COMMITTED registry/index.json
// must still be an exact, deterministic rebuild from registry/ledger.jsonl — and carry no duplicate
// id@version. This is the same invariant the CI `registry-index` job enforces with `git diff
// --exit-code`; pinning it as a test catches a hand-edited or stale index before CI. Reads the real
// committed files (no fixtures).
//
// POSTURE (ADR-0271, recorded so the next reader doesn't over-trust this): this assertion — and the
// CI job's `git diff --exit-code` — is DETECTION, not PREVENTION. A red run only stops a merge if
// `registry-index` is ALSO marked a required check with branch protection + CODEOWNERS on
// registry/index.json + registry/ledger.jsonl (an operator GitHub setting; this repo runs without
// enforced branch protection today — see the CLAUDE.md PR-review-gate note). A local `bun test` pass
// proves the index is a faithful rebuild; it proves nothing about who is allowed to land a bad one.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  INDEX_PATH,
  LEDGER_PATH,
  buildIndexFromLedgerFile,
  parseLedger,
  parseLedgerLines,
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
    // And coverage the other way: every ledgered module appears in the index — EXCEPT a delisted
    // id, which keeps its publish history but must be ABSENT from the served index (the whole
    // point of the delist line).
    const delisted = new Set(
      parseLedgerLines(readFileSync(LEDGER_PATH, "utf8")).delists.map(
        (d) => d.id,
      ),
    );
    const indexed = new Set(index.modules.map((m) => m.id));
    for (const id of highest.keys()) {
      expect(indexed.has(id)).toBe(!delisted.has(id));
    }
  });

  test("the dissolved edition metas are delisted: publish history kept, no index entry", () => {
    const { publishes, delists } = parseLedgerLines(
      readFileSync(LEDGER_PATH, "utf8"),
    );
    const index = JSON.parse(readFileSync(INDEX_PATH, "utf8")) as {
      modules: { id: string }[];
    };
    const indexed = new Set(index.modules.map((m) => m.id));
    const publishedIds = new Set(publishes.map((e) => e.id));
    const metas = [
      "@caisson/ai-kit",
      "@caisson/local-ai",
      "@caisson/agent-dev",
    ];
    const delistedIds = new Set(delists.map((d) => d.id));
    for (const id of metas) {
      expect(delistedIds.has(id)).toBe(true); // the delist lines exist
      expect(publishedIds.has(id)).toBe(true); // history preserved, append-only
      expect(indexed.has(id)).toBe(false); // gone from the served surface
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
    // The ONE sanctioned phantom, HISTORICAL only: everything@0.2.0/0.2.1 named @caisson/ui-pro
    // at the 0.0.0 sentinel before that package shipped (first publish 2026-07-07 — ui-pro@0.1.0;
    // everything@0.2.2 pins the real version). Append-only history keeps those two lines forever,
    // so the exemption is scoped to exactly them — a phantom pin in any NEW entry fails this test.
    const sanctionedPhantoms = new Set(["@caisson/ui-pro@0.0.0"]);
    const phantomSanctionedIn = new Set([
      "@caisson/everything@0.2.0",
      "@caisson/everything@0.2.1",
    ]);
    const stale: string[] = [];
    for (const e of entries) {
      const members = e.manifest?.members;
      if (!members) continue;
      for (const [memberId, version] of Object.entries(members)) {
        const pair = `${memberId}@${version}`;
        const sanctioned =
          sanctionedPhantoms.has(pair) &&
          phantomSanctionedIn.has(`${e.id}@${e.version}`);
        if (!publishedPairs.has(pair) && !sanctioned) {
          stale.push(`${e.id} → ${pair}`);
        }
      }
    }
    expect(stale).toEqual([]);
  });
});
