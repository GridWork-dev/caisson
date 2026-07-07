// Tests for registry/scripts/append-ledger.ts (ADR-0021/0069).
// NOTE: registry/ is not a workspace member, so @caisson/* bare specifiers do not resolve here —
// these tests use only relative imports + node built-ins.
import { describe, expect, test } from "bun:test";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ModuleManifest } from "../schema/module-manifest";
import {
  INDEX_PATH,
  LEDGER_PATH,
  buildIndexFromLedgerFile,
} from "./build-index";
import { appendLedger } from "./append-ledger";

/** Unique temp ledger path scoped to this test run (no cross-test contamination). */
function tmpLedger(label: string): string {
  return join(tmpdir(), `caisson-ledger-${label}-${process.pid}.jsonl`);
}

describe("registry ledger appender (ADR-0021/0069)", () => {
  test("append-then-rebuild is byte-identical to the committed index.json", () => {
    // Strategy: remove the last PUBLISH line (the tail may carry delist lines, which appendLedger
    // never writes) → re-append it via appendLedger → rebuild from the tmp ledger. Must equal
    // committed index.json byte-for-byte — this proves the appended entry is indistinguishable
    // from the original committed ledger record. Line order across ids does not affect the built
    // index (modules sort by id, versions by semver), so re-appending at the end is equivalent.
    const tmp = tmpLedger("roundtrip");
    try {
      const raw = readFileSync(LEDGER_PATH, "utf8");
      const lines = raw.split("\n").filter((l) => l.trim().length > 0);

      const delistedIds = new Set(
        lines
          .map((l) => JSON.parse(l) as { op?: string; id: string })
          .filter((e) => e.op === "delist")
          .map((e) => e.id),
      );
      // The re-appended line lands at the END of the tmp ledger, so it must not be a publish of a
      // delisted id (publish-after-delist is a ledger error by design).
      let lastPublishIdx = -1;
      for (let i = lines.length - 1; i >= 0; i--) {
        const e = JSON.parse(lines[i] as string) as { op?: string; id: string };
        if (e.op !== "delist" && !delistedIds.has(e.id)) {
          lastPublishIdx = i;
          break;
        }
      }
      if (lastPublishIdx < 0) throw new Error("ledger.jsonl has no publishes");
      const lastLine = lines[lastPublishIdx] as string;

      // Write everything except that publish line so appendLedger starts from a partial ledger.
      writeFileSync(
        tmp,
        lines.filter((_, i) => i !== lastPublishIdx).join("\n") + "\n",
      );

      // Parse the last entry's fields from the committed ledger.
      const last = JSON.parse(lastLine) as {
        manifest: ModuleManifest;
        publishedAt: string;
        gateAttestation: string;
      };

      // Re-append using appendLedger — must produce a byte-identical ledger line.
      appendLedger({
        manifest: last.manifest,
        publishedAt: last.publishedAt,
        gateAttestation: last.gateAttestation,
        ledgerPath: tmp,
      });

      const rebuilt = buildIndexFromLedgerFile(tmp);
      const committed = readFileSync(INDEX_PATH, "utf8");
      expect(rebuilt).toBe(committed);
    } finally {
      rmSync(tmp, { force: true });
    }
  });

  test("a malformed manifest throws before any file write (fail-closed boundary)", () => {
    const tmp = tmpLedger("malformed");
    try {
      writeFileSync(tmp, "");
      expect(() =>
        appendLedger({
          // @ts-expect-error intentionally malformed to test runtime boundary validation
          manifest: { id: "not-caisson-format", version: "1.0.0" },
          publishedAt: "2026-06-28T00:00:00.000Z",
          gateAttestation: "ci-x@abc",
          ledgerPath: tmp,
        }),
      ).toThrow();
      // The file must not have been written on failure (fail-closed, ADR-0005).
      expect(readFileSync(tmp, "utf8")).toBe("");
    } finally {
      rmSync(tmp, { force: true });
    }
  });

  test("publishedAt is taken from opts, never from the system clock", () => {
    // Write a deterministic past timestamp; verify it lands verbatim in the serialized entry.
    // If the function ever reads Date.now() instead, the written timestamp won't match.
    const tmp = tmpLedger("publishedat");
    try {
      writeFileSync(tmp, "");
      const fixedAt = "2020-01-01T00:00:00.000Z";
      appendLedger({
        manifest: {
          id: "@caisson/field-crypto",
          version: "0.1.0",
          kind: "primitive",
          editions: [],
          tier: "paid",
          priceCents: 4900,
          license: "LicenseRef-Caisson-Commercial",
          dependencies: ["@caisson/kernel"],
          members: {} as Record<string, string>,
          entry: "src/index.ts",
          agents: "AGENTS.md",
          golden: "src/__golden__",
          stability: "alpha",
          description: "Test entry for publishedAt determinism.",
        },
        publishedAt: fixedAt,
        gateAttestation: "ci-test@abc1234",
        ledgerPath: tmp,
      });
      const written = readFileSync(tmp, "utf8").trim();
      const parsed = JSON.parse(written) as { publishedAt: string };
      expect(parsed.publishedAt).toBe(fixedAt);
    } finally {
      rmSync(tmp, { force: true });
    }
  });
});
