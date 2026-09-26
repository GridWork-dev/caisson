import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  anchorChain,
  buildChain,
  canonicalize,
  ValidationError,
  type JsonValue,
} from "@caisson-sh/kernel/node";
import { matchGolden } from "@caisson-sh/testing";
import {
  flaggedResult,
  passResult,
  unresolvedResult,
  type CollectorResult,
} from "./collector.ts";
import { chainVerifyCollector } from "./collectors/chain-verify.ts";
import {
  EvidencePackBlockedError,
  type EvidenceControlPlan,
} from "./assemble.ts";
import {
  generateEvidencePack,
  type GenerateEvidencePackInput,
} from "./generate.ts";
import type { CrosswalkRollup } from "./crosswalk-rollup.ts";

// matchGolden anchors __golden__/ to the URL it is handed. ALL compliance goldens live in the ONE
// package-level dir (src/__golden__) — the same path the evidence-pack fixtures were written to — so
// anchor at src/index.ts (one level up from evidence/), exactly as pack-format.test does.
const PKG_SRC_META = new URL("../index.ts", import.meta.url).href;

const TENANT = "tenant-acme-prod";
const TIP = "0a1b2c3d".repeat(8); // the manifest's representative chain tip (matches the golden fixture)
const GENESIS = "9f8e7d6c".repeat(8);
const FRAMEWORK = {
  id: "soc2-tsc",
  title: "SOC 2 — Trust Services Criteria",
  version: "2024.1",
} as const;

/**
 * The audit-chain-integrity evidence, produced by the REAL chain-verify collector over a real
 * 128-entry chain + its minted anchor — proving the generator consumes genuine collector output. Its facts
 * (entryCount/anchorLength 128, valid) reproduce the golden chain item.
 */
function chainResult(): CollectorResult {
  const entries = buildChain(
    Array.from({ length: 128 }, (_unused, i) => ({ seq: i, event: "lock" })),
  );
  const anchor = anchorChain(entries);
  return chainVerifyCollector().collect({ entries, anchor });
}

/**
 * A passing WORM-retention item with one (unfilled) manual slot. Built as an illustrative collector
 * result (its id/title/facts match the canonical golden body, which is illustrative — the golden
 * pins the format, not the live collector wiring), exercising the generator's assembly + slot-fill mapping.
 */
function wormResult(): CollectorResult {
  return passResult({
    collectorId: "substrate.worm-retention",
    controlId: "AUDIT.IMMUTABLE-LOG",
    title: "WORM retention floor met for the locked artifact",
    summary: "locked artifact retained beyond the legal floor",
    facts: {
      mode: "GOVERNANCE",
      retainUntil: "2032-06-27T00:00:00.000Z",
      requiredUntil: "2031-06-27T00:00:00.000Z",
      meetsFloor: true,
    },
    manualSlots: [
      {
        id: "retention-policy-pdf",
        label: "Signed records-retention policy (PDF)",
        required: false,
      },
    ],
  });
}

/** A flagged FORCE-RLS item — a real gap carrying its mandatory recorded reason (illustrative). */
function rlsFlaggedResult(): CollectorResult {
  return flaggedResult(
    {
      collectorId: "substrate.rls-force",
      controlId: "DATA-PROTECTION.TENANT-ISOLATION",
      title: "FORCE row-level security posture",
      summary: "one tenant table is missing a FORCE RLS policy",
      facts: {
        tablesChecked: 6,
        tablesForced: 5,
        tablesMissingForce: 1,
        missing: ["legacy_export"],
      },
      manualSlots: [],
    },
    'table "legacy_export" has RLS enabled but not FORCEd; a table owner could bypass the policy',
  );
}

const immutableLogControl = (): EvidenceControlPlan => ({
  controlId: "AUDIT.IMMUTABLE-LOG",
  title: "Immutable audit log",
  family: "Audit & Accountability",
  statement:
    "Security-relevant events are written to an append-only, hash-chained log that cannot " +
    "be altered or deleted after the fact, and the chain is anchored in WORM storage.",
  crosswalk: [
    { framework: "SOC2-TSC", reference: "CC7.2", note: "System monitoring" },
    { framework: "HIPAA-Security", reference: "164.312(b)" },
  ],
  evidence: [chainResult(), wormResult()],
});

const tenantIsolationControl = (): EvidenceControlPlan => ({
  controlId: "DATA-PROTECTION.TENANT-ISOLATION",
  title: "Row-level tenant isolation",
  family: "Access Control",
  statement:
    "Every tenant-scoped table enforces FORCE row-level security so that no role — including " +
    "the table owner — can read or write another tenant's rows.",
  crosswalk: [{ framework: "SOC2-TSC", reference: "CC6.1" }],
  evidence: [rlsFlaggedResult()],
});

/**
 * A small, hand-written rollup mirroring this file's own two illustrative controls' crosswalk
 * pointers — kept self-contained (not computed against the real frameworks-pack catalogs) so this
 * generator-plumbing test stays decoupled from catalog content; the real join logic is proven
 * against the real catalogs in `crosswalk-rollup.test.ts`. Sorted (framework, reference), as the
 * generator's own determinism contract requires.
 */
function sampleRollup(): CrosswalkRollup {
  return {
    cells: [
      {
        framework: "HIPAA-Security",
        reference: "164.312(b)",
        canonicalControlIds: ["AUDIT.IMMUTABLE-LOG"],
        status: "ready",
        claim: "maps-to",
        evidencePointers: ["AUDIT.IMMUTABLE-LOG"],
      },
      {
        framework: "SOC2-TSC",
        reference: "CC6.1",
        canonicalControlIds: ["DATA-PROTECTION.TENANT-ISOLATION"],
        status: "gap",
        claim: "maps-to",
        evidencePointers: ["DATA-PROTECTION.TENANT-ISOLATION"],
      },
      {
        framework: "SOC2-TSC",
        reference: "CC7.2",
        canonicalControlIds: ["AUDIT.IMMUTABLE-LOG"],
        status: "ready",
        claim: "maps-to",
        evidencePointers: ["AUDIT.IMMUTABLE-LOG"],
      },
    ],
  };
}

function baseInput(): GenerateEvidencePackInput {
  return {
    tenantId: TENANT,
    framework: FRAMEWORK,
    chainAnchor: { length: 128, tipHash: TIP, genesisHash: GENESIS },
    controls: [immutableLogControl(), tenantIsolationControl()],
    now: new Date("2026-06-27T12:00:00.000Z"),
    crosswalkRollup: sampleRollup(),
  };
}

/** An unresolved backup-retention item — evidence absent, the collector refuses to guess. */
function backupUnresolvedResult(): CollectorResult {
  return unresolvedResult(
    {
      collectorId: "substrate.worm-retention",
      controlId: "AVAILABILITY.BACKUP-RESTORE",
      title: "WORM retention floor met for the locked artifact",
      summary: "no WORM retention term was found for the backup artifact class",
      facts: {
        key: "tenant-acme-prod/backups/2026-06",
        retainUntil: null,
        requiredUntil: "2033-06-27T00:00:00.000Z",
      },
      manualSlots: [],
    },
    "no WORM retention term was found for the backup artifact class; evidence absent, status cannot be determined",
  );
}

describe("generateEvidencePack — canonical body (T12 golden, BLESS unset)", () => {
  test("the assembled manifest body is byte-stable against the T12 golden", () => {
    const pack = generateEvidencePack(baseInput());
    matchGolden(PKG_SRC_META, "evidence-pack.manifest", pack.manifest);
  });

  test("the canonical (signable) body equals the golden's canonical bytes", () => {
    const pack = generateEvidencePack(baseInput());
    const golden = JSON.parse(
      readFileSync(
        new URL("../__golden__/evidence-pack.manifest.json", import.meta.url),
        "utf8",
      ),
    ) as JsonValue;
    expect(pack.canonicalManifest).toBe(canonicalize(golden));
  });

  test("derives readiness, summary counts, and posture from the evidence", () => {
    const { manifest } = generateEvidencePack(baseInput());
    const byId = (id: string) =>
      manifest.controls.find((c) => c.controlId === id);
    expect(byId("AUDIT.IMMUTABLE-LOG")?.readiness).toBe("ready");
    expect(byId("DATA-PROTECTION.TENANT-ISOLATION")?.readiness).toBe("gap");
    expect(manifest.summary.totalControls).toBe(2);
    expect(manifest.summary.controlsReady).toBe(1);
    expect(manifest.summary.controlsWithGaps).toBe(1);
    expect(manifest.summary.totalEvidenceItems).toBe(3);
  });

  test("assembles the caller-computed crosswalkRollup into the manifest unchanged (v2)", () => {
    const { manifest } = generateEvidencePack(baseInput());
    expect(manifest.crosswalkRollup).toEqual(sampleRollup());
  });

  test("the canonical body excludes the clock and any signature (edge-injected)", () => {
    const pack = generateEvidencePack(baseInput());
    expect(pack.generatedAt).toBe("2026-06-27T12:00:00.000Z");
    expect(pack.canonicalManifest).not.toMatch(/generatedAt|signature/);
  });

  test("posture copy never claims compliant/certified (TM-K honesty)", () => {
    const pack = generateEvidencePack(baseInput());
    expect(pack.manifest.summary.posture).not.toMatch(/compliant|certified/i);
    expect(pack.canonicalManifest).not.toMatch(/compliant|certified/i);
  });
});

describe("generateEvidencePack — flag-never-guess (BLOCKED case)", () => {
  test("an unresolved item throws EvidencePackBlockedError matching the golden, with no pack", () => {
    const input: GenerateEvidencePackInput = {
      ...baseInput(),
      controls: [
        // A fully-passing control is present, yet ONE unresolved control blocks the whole pack.
        immutableLogControl(),
        {
          controlId: "AVAILABILITY.BACKUP-RESTORE",
          title: "Backup and restore",
          family: "Availability",
          statement:
            "Backups of tenant data are taken, retained under a WORM term, and periodically restore-tested.",
          crosswalk: [{ framework: "SOC2-TSC", reference: "A1.2" }],
          evidence: [backupUnresolvedResult()],
        },
      ],
    };

    let caught: unknown;
    try {
      generateEvidencePack(input);
      throw new Error("expected generateEvidencePack to throw");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(EvidencePackBlockedError);
    const report = (caught as EvidencePackBlockedError).report;
    expect(report.blocked).toBe(true);
    expect(report.unresolved).toHaveLength(1);
    matchGolden(PKG_SRC_META, "evidence-pack.blocked", report);
  });

  test("a flagged item with no recorded reason fails closed (ValidationError)", () => {
    // Hand-craft a malformed result that bypasses the flaggedResult constructor's reason guard.
    const malformed: CollectorResult = {
      item: {
        collectorId: "substrate.rls-force",
        controlId: "DATA-PROTECTION.TENANT-ISOLATION",
        title: "FORCE row-level security posture",
        summary: "one tenant table is missing a FORCE RLS policy",
        facts: {},
        manualSlots: [],
      },
      status: "flagged",
    };
    const input: GenerateEvidencePackInput = {
      ...baseInput(),
      controls: [{ ...tenantIsolationControl(), evidence: [malformed] }],
    };
    expect(() => generateEvidencePack(input)).toThrow(ValidationError);
  });
});

describe("generateEvidencePack — deterministic archive", () => {
  test("identical input yields a byte-identical archive and SHA-256", () => {
    const a = generateEvidencePack(baseInput());
    const b = generateEvidencePack(baseInput());
    expect(a.sha256).toBe(b.sha256);
    expect(Buffer.from(a.archive).equals(Buffer.from(b.archive))).toBe(true);
    expect(/^[0-9a-f]{64}$/.test(a.sha256)).toBe(true);
  });

  test("the injected clock never changes the archive bytes or digest", () => {
    const a = generateEvidencePack(baseInput());
    const later = generateEvidencePack({
      ...baseInput(),
      now: new Date("2030-01-01T00:00:00.000Z"),
    });
    expect(later.sha256).toBe(a.sha256);
    expect(later.canonicalManifest).toBe(a.canonicalManifest);
    expect(later.generatedAt).not.toBe(a.generatedAt);
  });

  test("input order (controls) never changes the canonical body or digest", () => {
    const a = generateEvidencePack(baseInput());
    const reordered = generateEvidencePack({
      ...baseInput(),
      controls: [tenantIsolationControl(), immutableLogControl()],
    });
    expect(reordered.canonicalManifest).toBe(a.canonicalManifest);
    expect(reordered.sha256).toBe(a.sha256);
  });

  test("the archive is a well-formed ZIP (local + EOCD signatures)", () => {
    const { archive } = generateEvidencePack(baseInput());
    // Local file header signature "PK\x03\x04" at the start.
    expect(Array.from(archive.subarray(0, 4))).toEqual([
      0x50, 0x4b, 0x03, 0x04,
    ]);
    // End-of-central-directory signature "PK\x05\x06" in the trailing 22-byte record.
    const eocd = archive.subarray(archive.length - 22, archive.length - 18);
    expect(Array.from(eocd)).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });
});
