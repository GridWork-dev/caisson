// registry/scripts/prune-versions.test.ts — golden/round-trip tests for the version-delist prune
// CLI (ADR-0359, CAISSON-125). All fixtures are SYNTHETIC — never touches the real
// registry/ledger.jsonl or registry/tarballs.json.
import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildIndex, parseLedgerLines } from "./build-index";
import {
  applyPrune,
  parseMissingFileText,
  parsePruneLine,
  planPrune,
  runPrune,
} from "./prune-versions";

/** A minimal valid publish line (mirrors build-index.test.ts's `pub` fixture). */
const pub = (id: string, version: string) => ({
  id,
  version,
  publishedAt: "2026-06-27T00:00:00.000Z",
  gateAttestation: "ci-x@abc",
  manifest: {
    id,
    version,
    kind: "primitive",
    editions: [],
    tier: "paid",
    priceCents: 100,
    license: "LicenseRef-Caisson-Commercial",
    dependencies: [],
    members: {},
    entry: "src/index.ts",
    agents: "AGENTS.md",
    golden: null,
    stability: "alpha",
    description: "x",
  },
});
const delist = (id: string) => ({
  op: "delist",
  id,
  delistedAt: "2026-07-07T16:00:00.000Z",
  reason: "test delist",
});
const jsonl = (...lines: object[]) =>
  `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`;

/** Unique temp dir scoped to this test run (no cross-test contamination). */
function tmpDir(label: string): string {
  const d = join(tmpdir(), `caisson-prune-versions-${label}-${process.pid}`);
  mkdirSync(d, { recursive: true });
  return d;
}

/** The synthetic fixture shared by the golden/round-trip tests below:
 *  - @caisson/alpha: 0.1.0, 0.2.0, 0.3.0 (latest 0.3.0) — live module, two superseded versions.
 *  - @caisson/beta: 1.0.0, 1.1.0 (latest 1.1.0) — live module, one superseded version.
 *  - @caisson/gone: 0.1.0, 0.2.0, then module-delisted (mirrors the real ai-kit/local-ai/agent-dev
 *    ADR-0271 rows) — both its tarballs.json rows are stale-cleanup targets.
 *  tarballs.json carries a row for every one of the 7 published versions above. */
function writeFixture(dir: string): {
  ledgerPath: string;
  indexPath: string;
  sidecarPath: string;
} {
  const ledgerPath = join(dir, "ledger.jsonl");
  const indexPath = join(dir, "index.json");
  const sidecarPath = join(dir, "tarballs.json");
  writeFileSync(
    ledgerPath,
    jsonl(
      pub("@caisson/alpha", "0.1.0"),
      pub("@caisson/alpha", "0.2.0"),
      pub("@caisson/alpha", "0.3.0"),
      pub("@caisson/beta", "1.0.0"),
      pub("@caisson/beta", "1.1.0"),
      pub("@caisson/gone", "0.1.0"),
      pub("@caisson/gone", "0.2.0"),
      delist("@caisson/gone"),
    ),
  );
  const { publishes, delists } = parseLedgerLines(
    readFileSync(ledgerPath, "utf8"),
  );
  writeFileSync(
    indexPath,
    `${JSON.stringify(buildIndex(publishes, delists), null, 2)}\n`,
  );
  const rows = {
    "@caisson/alpha@0.1.0": {
      key: "alpha/alpha-0.1.0.tgz",
      shasum: "a1",
      integrity: "sha512-a1",
      size: 10,
    },
    "@caisson/alpha@0.2.0": {
      key: "alpha/alpha-0.2.0.tgz",
      shasum: "a2",
      integrity: "sha512-a2",
      size: 10,
    },
    "@caisson/alpha@0.3.0": {
      key: "alpha/alpha-0.3.0.tgz",
      shasum: "a3",
      integrity: "sha512-a3",
      size: 10,
    },
    "@caisson/beta@1.0.0": {
      key: "beta/beta-1.0.0.tgz",
      shasum: "b1",
      integrity: "sha512-b1",
      size: 10,
    },
    "@caisson/beta@1.1.0": {
      key: "beta/beta-1.1.0.tgz",
      shasum: "b2",
      integrity: "sha512-b2",
      size: 10,
    },
    "@caisson/gone@0.1.0": {
      key: "gone/gone-0.1.0.tgz",
      shasum: "g1",
      integrity: "sha512-g1",
      size: 10,
    },
    "@caisson/gone@0.2.0": {
      key: "gone/gone-0.2.0.tgz",
      shasum: "g2",
      integrity: "sha512-g2",
      size: 10,
    },
  };
  writeFileSync(
    sidecarPath,
    `${JSON.stringify({ tarballs: rows }, null, 2)}\n`,
  );
  return { ledgerPath, indexPath, sidecarPath };
}

describe("parsePruneLine (--missing-file format)", () => {
  test("parses the primary @caisson/<slug>@<version> form", () => {
    expect(parsePruneLine("@caisson/auth@1.2.3")).toEqual({
      id: "@caisson/auth",
      version: "1.2.3",
      key: "@caisson/auth@1.2.3",
    });
  });

  test("parses the R2 object-key form <slug>/<slug>-<version>.tgz", () => {
    expect(parsePruneLine("auth/auth-1.2.3.tgz")).toEqual({
      id: "@caisson/auth",
      version: "1.2.3",
      key: "@caisson/auth@1.2.3",
    });
  });

  test("skips blank lines and #-comments (returns null)", () => {
    expect(parsePruneLine("")).toBeNull();
    expect(parsePruneLine("   ")).toBeNull();
    expect(parsePruneLine("# a comment")).toBeNull();
  });

  test("skips malformed lines (returns null, not a throw)", () => {
    expect(parsePruneLine("not-a-valid-line")).toBeNull();
    expect(parsePruneLine("@caisson/")).toBeNull();
    expect(parsePruneLine("@caisson/auth")).toBeNull(); // no version
  });

  /** Renders a report line EXACTLY the way r2-parity-probe.ts's renderReport does. */
  const renderReportLine = (status: string, key: string, detail: string) =>
    `  ${status.toUpperCase().padEnd(14)} ${key} — ${detail}`;

  test("accepts a realistic r2-parity-probe.ts MISSING report line, rejects OK/summary lines", () => {
    const missingLine = renderReportLine(
      "missing",
      "auth/auth-1.2.3.tgz",
      "advertised in tarballs.json but 404 from R2",
    );
    expect(parsePruneLine(missingLine)).toEqual({
      id: "@caisson/auth",
      version: "1.2.3",
      key: "@caisson/auth@1.2.3",
    });

    const okLine = renderReportLine(
      "ok",
      "auth/auth-1.0.0.tgz",
      "abc123 . 10B",
    );
    expect(parsePruneLine(okLine)).toBeNull();

    expect(
      parsePruneLine("R2 parity: 96/99 advertised objects reproduce"),
    ).toBeNull();
    expect(parsePruneLine("RESULT: DRIFT DETECTED")).toBeNull();
  });
});

describe("parseMissingFileText (skipped-line counting)", () => {
  test("counts unparseable non-blank, non-comment lines; blanks and comments are exempt", () => {
    const text = [
      "@caisson/alpha@0.1.0",
      "",
      "# a comment",
      "not-a-valid-line",
      "@caisson/beta@1.0.0",
      "also garbage",
    ].join("\n");
    const { targets, skipped } = parseMissingFileText(text);
    expect(targets.map((t) => t.key)).toEqual([
      "@caisson/alpha@0.1.0",
      "@caisson/beta@1.0.0",
    ]);
    expect(skipped).toBe(2);
  });

  test("a clean file has zero skipped", () => {
    expect(parseMissingFileText("@caisson/alpha@0.1.0\n").skipped).toBe(0);
  });
});

describe("prune-versions golden / round-trip (ADR-0359)", () => {
  test("plan classifies live-module, sidecar-cleanup, and refused targets correctly", () => {
    const dir = tmpDir("plan");
    try {
      const { ledgerPath } = writeFixture(dir);
      const ledgerText = readFileSync(ledgerPath, "utf8");
      const targets = [
        { id: "@caisson/alpha", version: "0.1.0", key: "@caisson/alpha@0.1.0" },
        { id: "@caisson/beta", version: "1.0.0", key: "@caisson/beta@1.0.0" },
        { id: "@caisson/gone", version: "0.1.0", key: "@caisson/gone@0.1.0" },
        { id: "@caisson/gone", version: "0.2.0", key: "@caisson/gone@0.2.0" },
        { id: "@caisson/alpha", version: "0.3.0", key: "@caisson/alpha@0.3.0" }, // is latest
        { id: "@caisson/beta", version: "9.9.9", key: "@caisson/beta@9.9.9" }, // never published
      ];
      const plan = planPrune(targets, ledgerText);

      expect(plan.toApply.map((t) => t.key)).toEqual([
        "@caisson/alpha@0.1.0",
        "@caisson/beta@1.0.0",
      ]);
      expect(plan.toPruneSidecar.map((t) => t.key)).toEqual([
        "@caisson/alpha@0.1.0",
        "@caisson/beta@1.0.0",
        "@caisson/gone@0.1.0",
        "@caisson/gone@0.2.0",
      ]);
      expect(plan.refused.map((r) => r.target.key)).toEqual([
        "@caisson/alpha@0.3.0",
        "@caisson/beta@9.9.9",
      ]);
      expect(
        plan.rows.find((r) => r.target.key === "@caisson/gone@0.1.0")?.status,
      ).toBe("sidecar-cleanup");
      expect(
        plan.rows.find((r) => r.target.key === "@caisson/alpha@0.3.0")?.status,
      ).toBe("is-latest");
      expect(
        plan.rows.find((r) => r.target.key === "@caisson/beta@9.9.9")?.status,
      ).toBe("not-published");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("apply: index.json excludes exactly the pruned versions, latest preserved, tarballs.json drops exactly those rows, refused rows untouched", () => {
    const dir = tmpDir("apply");
    try {
      const { ledgerPath, indexPath, sidecarPath } = writeFixture(dir);
      const ledgerBefore = readFileSync(ledgerPath, "utf8");
      const targets = [
        { id: "@caisson/alpha", version: "0.1.0", key: "@caisson/alpha@0.1.0" },
        { id: "@caisson/beta", version: "1.0.0", key: "@caisson/beta@1.0.0" },
        { id: "@caisson/gone", version: "0.1.0", key: "@caisson/gone@0.1.0" },
        { id: "@caisson/gone", version: "0.2.0", key: "@caisson/gone@0.2.0" },
        { id: "@caisson/alpha", version: "0.3.0", key: "@caisson/alpha@0.3.0" },
      ];
      const plan = planPrune(targets, ledgerBefore);
      const result = applyPrune({
        ledgerTargets: plan.toApply,
        sidecarTargets: plan.toPruneSidecar,
        delistedAt: "2026-07-17T20:00:00.000Z",
        reason: "test prune",
        ledgerPath,
        indexPath,
        sidecarPath,
      });

      // Exactly 2 ledger lines appended (the 2 live-module targets); the 2 gone@* sidecar-cleanup
      // targets append ZERO ledger lines.
      expect(result.appended).toBe(2);
      const ledgerAfter = readFileSync(ledgerPath, "utf8");
      expect(ledgerAfter.startsWith(ledgerBefore)).toBe(true); // append-only
      const appendedText = ledgerAfter.slice(ledgerBefore.length);
      const appendedLines = appendedText
        .split("\n")
        .filter((l) => l.length > 0);
      expect(appendedLines).toHaveLength(2);

      // index.json: alpha keeps 0.2.0/0.3.0 (latest 0.3.0); beta keeps 1.1.0 (latest); gone absent.
      const index = JSON.parse(readFileSync(indexPath, "utf8")) as {
        modules: {
          id: string;
          latest: string;
          versions: { version: string }[];
        }[];
      };
      const alpha = index.modules.find((m) => m.id === "@caisson/alpha");
      const beta = index.modules.find((m) => m.id === "@caisson/beta");
      const gone = index.modules.find((m) => m.id === "@caisson/gone");
      expect(alpha?.versions.map((v) => v.version)).toEqual(["0.2.0", "0.3.0"]);
      expect(alpha?.latest).toBe("0.3.0");
      expect(beta?.versions.map((v) => v.version)).toEqual(["1.1.0"]);
      expect(beta?.latest).toBe("1.1.0");
      expect(gone).toBeUndefined(); // module-delisted, unaffected by this run

      // tarballs.json: exactly the 4 pruned rows are gone; the 3 others (incl. the refused
      // alpha@0.3.0) survive untouched.
      const sidecar = JSON.parse(readFileSync(sidecarPath, "utf8")) as {
        tarballs: Record<string, unknown>;
      };
      expect(Object.keys(sidecar.tarballs).sort()).toEqual([
        "@caisson/alpha@0.2.0",
        "@caisson/alpha@0.3.0",
        "@caisson/beta@1.1.0",
      ]);
      expect(result.tarballsRemoved).toBe(4);

      // Round-trip: re-parsing the mutated ledger sees the appended delists as valid version-delists.
      const { delists } = parseLedgerLines(ledgerAfter);
      const versionDelists = delists.filter((d) => d.version !== undefined);
      expect(versionDelists.map((d) => `${d.id}@${d.version}`).sort()).toEqual([
        "@caisson/alpha@0.1.0",
        "@caisson/beta@1.0.0",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("module-already-delisted target: sidecar row removed, ZERO ledger lines appended", () => {
    const dir = tmpDir("sidecar-only");
    try {
      const { ledgerPath, indexPath, sidecarPath } = writeFixture(dir);
      const ledgerBefore = readFileSync(ledgerPath, "utf8");
      const indexBefore = readFileSync(indexPath, "utf8");
      const targets = [
        { id: "@caisson/gone", version: "0.1.0", key: "@caisson/gone@0.1.0" },
        { id: "@caisson/gone", version: "0.2.0", key: "@caisson/gone@0.2.0" },
      ];
      const plan = planPrune(targets, ledgerBefore);
      expect(plan.toApply).toHaveLength(0); // no ledger targets at all
      expect(plan.toPruneSidecar.map((t) => t.key)).toEqual([
        "@caisson/gone@0.1.0",
        "@caisson/gone@0.2.0",
      ]);

      const result = applyPrune({
        ledgerTargets: plan.toApply,
        sidecarTargets: plan.toPruneSidecar,
        delistedAt: "2026-07-17T20:00:00.000Z",
        reason: "test prune",
        ledgerPath,
        indexPath,
        sidecarPath,
      });

      expect(result.appended).toBe(0);
      expect(readFileSync(ledgerPath, "utf8")).toBe(ledgerBefore); // untouched, byte-identical
      expect(readFileSync(indexPath, "utf8")).toBe(indexBefore); // untouched — nothing to rebuild
      expect(result.tarballsRemoved).toBe(2);
      const sidecar = JSON.parse(readFileSync(sidecarPath, "utf8")) as {
        tarballs: Record<string, unknown>;
      };
      expect(sidecar.tarballs["@caisson/gone@0.1.0"]).toBeUndefined();
      expect(sidecar.tarballs["@caisson/gone@0.2.0"]).toBeUndefined();
      // The 5 unrelated rows survive.
      expect(Object.keys(sidecar.tarballs)).toHaveLength(5);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("re-run is idempotent: already-delisted + already-cleaned-up targets apply as a no-op", () => {
    const dir = tmpDir("idempotent");
    try {
      const { ledgerPath, indexPath, sidecarPath } = writeFixture(dir);
      const targets = [
        { id: "@caisson/alpha", version: "0.1.0", key: "@caisson/alpha@0.1.0" },
        { id: "@caisson/gone", version: "0.1.0", key: "@caisson/gone@0.1.0" },
      ];
      const firstLedger = readFileSync(ledgerPath, "utf8");
      const firstPlan = planPrune(targets, firstLedger);
      applyPrune({
        ledgerTargets: firstPlan.toApply,
        sidecarTargets: firstPlan.toPruneSidecar,
        delistedAt: "2026-07-17T20:00:00.000Z",
        reason: "test prune",
        ledgerPath,
        indexPath,
        sidecarPath,
      });

      const ledgerAfterFirst = readFileSync(ledgerPath, "utf8");
      const indexAfterFirst = readFileSync(indexPath, "utf8");
      const sidecarAfterFirst = readFileSync(sidecarPath, "utf8");

      // Re-run over the SAME target file against the now-mutated ledger.
      const secondPlan = planPrune(targets, ledgerAfterFirst);
      expect(secondPlan.toApply).toHaveLength(0); // alpha@0.1.0 already version-delisted
      expect(
        secondPlan.rows.find((r) => r.target.key === "@caisson/alpha@0.1.0")
          ?.status,
      ).toBe("already-delisted");
      expect(
        secondPlan.rows.find((r) => r.target.key === "@caisson/gone@0.1.0")
          ?.status,
      ).toBe("sidecar-cleanup");

      const result = applyPrune({
        ledgerTargets: secondPlan.toApply,
        sidecarTargets: secondPlan.toPruneSidecar,
        delistedAt: "2026-07-17T21:00:00.000Z",
        reason: "test prune re-run",
        ledgerPath,
        indexPath,
        sidecarPath,
      });

      expect(result.appended).toBe(0);
      expect(result.tarballsRemoved).toBe(0); // both rows already gone — nothing left to remove
      expect(readFileSync(ledgerPath, "utf8")).toBe(ledgerAfterFirst);
      expect(readFileSync(indexPath, "utf8")).toBe(indexAfterFirst);
      expect(readFileSync(sidecarPath, "utf8")).toBe(sidecarAfterFirst);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("applyPrune throws (fail-closed) if asked to delist the current latest — no partial write", () => {
    const dir = tmpDir("throws-latest");
    try {
      const { ledgerPath, indexPath, sidecarPath } = writeFixture(dir);
      const ledgerBefore = readFileSync(ledgerPath, "utf8");
      const indexBefore = readFileSync(indexPath, "utf8");
      const sidecarBefore = readFileSync(sidecarPath, "utf8");
      // Bypass planPrune's own refusal — prove applyPrune's defense-in-depth (buildIndex's own
      // fail-closed assert) also rejects it, and that nothing was written on the way there.
      const latestTarget = {
        id: "@caisson/alpha",
        version: "0.3.0",
        key: "@caisson/alpha@0.3.0",
      };
      expect(() =>
        applyPrune({
          ledgerTargets: [latestTarget],
          sidecarTargets: [latestTarget],
          delistedAt: "2026-07-17T20:00:00.000Z",
          reason: "test prune",
          ledgerPath,
          indexPath,
          sidecarPath,
        }),
      ).toThrow(/would orphan latest/);
      // No partial application: ledger, index, and sidecar are all byte-identical to before.
      expect(readFileSync(ledgerPath, "utf8")).toBe(ledgerBefore);
      expect(readFileSync(indexPath, "utf8")).toBe(indexBefore);
      expect(readFileSync(sidecarPath, "utf8")).toBe(sidecarBefore);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("runPrune: skipped > 0 aborts BEFORE any write in --write mode, and reports exit 1 in dry-run too", () => {
    const dir = tmpDir("skipped-abort");
    try {
      const { ledgerPath, indexPath, sidecarPath } = writeFixture(dir);
      const ledgerBefore = readFileSync(ledgerPath, "utf8");
      const indexBefore = readFileSync(indexPath, "utf8");
      const sidecarBefore = readFileSync(sidecarPath, "utf8");
      // One otherwise-clean, applicable target — proves skipped alone (not an empty target list)
      // is what blocks the run: a mangled paste with ONE bad line must never half-apply the rest.
      const targets = [
        { id: "@caisson/alpha", version: "0.1.0", key: "@caisson/alpha@0.1.0" },
      ];

      const writeRun = runPrune({
        targets,
        skipped: 1,
        ledgerText: ledgerBefore,
        write: true,
        delistedAt: "2026-07-17T20:00:00.000Z",
        reason: "test prune",
        ledgerPath,
        indexPath,
        sidecarPath,
      });
      expect(writeRun.applied).toBeNull();
      expect(writeRun.exitCode).toBe(1);
      // Nothing was written: applyPrune was never reached.
      expect(readFileSync(ledgerPath, "utf8")).toBe(ledgerBefore);
      expect(readFileSync(indexPath, "utf8")).toBe(indexBefore);
      expect(readFileSync(sidecarPath, "utf8")).toBe(sidecarBefore);

      const dryRun = runPrune({
        targets,
        skipped: 1,
        ledgerText: ledgerBefore,
        write: false,
        delistedAt: "2026-07-17T20:00:00.000Z",
        reason: "test prune",
        ledgerPath,
        indexPath,
        sidecarPath,
      });
      expect(dryRun.applied).toBeNull();
      expect(dryRun.exitCode).toBe(1); // fail-loud even though dry-run never writes either way

      // A clean run (skipped: 0) over the SAME target set succeeds, proving skipped was the gate.
      const cleanRun = runPrune({
        targets,
        skipped: 0,
        ledgerText: ledgerBefore,
        write: true,
        delistedAt: "2026-07-17T20:00:00.000Z",
        reason: "test prune",
        ledgerPath,
        indexPath,
        sidecarPath,
      });
      expect(cleanRun.applied).not.toBeNull();
      expect(cleanRun.exitCode).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
