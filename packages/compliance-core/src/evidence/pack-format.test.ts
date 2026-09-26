import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import { ValidationError, canonicalize } from "@caisson-sh/kernel";
import type { JsonValue } from "@caisson-sh/kernel";
import { matchGolden } from "@caisson-sh/testing";
import {
  EVIDENCE_PACK_FORMAT_VERSION,
  type evidencePackBlockedSchema,
  type evidencePackManifestSchema,
  parseEvidencePackBlocked,
  parseEvidencePackManifest,
} from "./pack-format.ts";

// matchGolden anchors __golden__/ to the file URL it is handed. The compliance package keeps ALL
// goldens in ONE package-level dir (src/__golden__ — the path the manifest's `golden` field gates),
// so anchor at src/ (one level up from evidence/), not this test's own subdir.
const PKG_SRC_META = new URL("../index.ts", import.meta.url).href;

type ManifestInput = z.input<typeof evidencePackManifestSchema>;
type ItemInput = ManifestInput["controls"][number]["evidence"][number];
type BlockedInput = z.input<typeof evidencePackBlockedSchema>;

const TENANT = "tenant-acme-prod";
const TIP = "0a1b2c3d".repeat(8); // 64 hex chars — a representative chain tip hash
const GENESIS = "9f8e7d6c".repeat(8); // 64 hex chars — a representative genesis hash

/** The header fields shared by the manifest and the blocked report (format, tenant, framework). */
function commonMeta(): {
  formatVersion: typeof EVIDENCE_PACK_FORMAT_VERSION;
  tenantId: string;
  framework: { id: string; title: string; version: string };
} {
  return {
    formatVersion: EVIDENCE_PACK_FORMAT_VERSION,
    tenantId: TENANT,
    framework: {
      id: "soc2-tsc",
      title: "SOC 2 — Trust Services Criteria",
      version: "2024.1",
    },
  };
}

/** The manifest-only top-level body fields (the common header plus the WORM chain anchor). */
function manifestMeta() {
  return {
    ...commonMeta(),
    chainAnchor: { length: 128, tipHash: TIP, genesisHash: GENESIS },
  };
}

/** A passing audit-chain-integrity evidence item (mirrors the chain-verify collector facts). */
function chainPassItem(): ItemInput {
  return {
    collectorId: "substrate.audit-chain-integrity",
    title: "Append-only audit chain integrity (WORM-anchored)",
    summary: "audit chain verified against its anchor (128 entries)",
    status: "pass",
    facts: {
      entryCount: 128,
      anchorPresent: true,
      anchorLength: 128,
      valid: true,
      brokenAt: null,
    },
    manualSlots: [],
  };
}

/** A passing WORM-retention evidence item with one (unfilled, optional) manual attachment slot. */
function wormPassItem(): ItemInput {
  return {
    collectorId: "substrate.worm-retention",
    title: "WORM retention floor met for the locked artifact",
    summary: "locked artifact retained beyond the legal floor",
    status: "pass",
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
        filled: false,
      },
    ],
  };
}

/** A flagged FORCE-RLS evidence item — a real gap, carrying its mandatory recorded reason. */
function rlsFlaggedItem(): ItemInput {
  return {
    collectorId: "substrate.rls-force",
    title: "FORCE row-level security posture",
    summary: "one tenant table is missing a FORCE RLS policy",
    status: "flagged",
    reason:
      'table "legacy_export" has RLS enabled but not FORCEd; a table owner could bypass the policy',
    facts: {
      tablesChecked: 6,
      tablesForced: 5,
      tablesMissingForce: 1,
      missing: ["legacy_export"],
    },
    manualSlots: [],
  };
}

/** An empty rollup — used only by the one-off negative-path fixtures below; these exercise the
 *  format contract, not the rollup join itself (that lives in `crosswalk-rollup.test.ts`). */
function emptyRollup(): { cells: never[] } {
  return { cells: [] };
}

/**
 * The rollup for `sampleManifestInput()`'s two controls, mirroring their own crosswalk pointers.
 * MUST stay byte-identical to `generate.test.ts`'s `sampleRollup()` — both fixtures assemble the
 * SAME illustrative manifest and share the `evidence-pack.manifest` golden as a cross-check.
 */
function sampleRollup(): ManifestInput["crosswalkRollup"] {
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

/** A representative two-control manifest input: one ready (all pass), one gap (one flagged). */
function sampleManifestInput(): ManifestInput {
  return {
    ...manifestMeta(),
    crosswalkRollup: sampleRollup(),
    controls: [
      {
        controlId: "AUDIT.IMMUTABLE-LOG",
        title: "Immutable audit log",
        family: "Audit & Accountability",
        statement:
          "Security-relevant events are written to an append-only, hash-chained log that cannot " +
          "be altered or deleted after the fact, and the chain is anchored in WORM storage.",
        crosswalk: [
          {
            framework: "SOC2-TSC",
            reference: "CC7.2",
            note: "System monitoring",
          },
          { framework: "HIPAA-Security", reference: "164.312(b)" },
        ],
        evidence: [chainPassItem(), wormPassItem()],
        readiness: "ready",
      },
      {
        controlId: "DATA-PROTECTION.TENANT-ISOLATION",
        title: "Row-level tenant isolation",
        family: "Access Control",
        statement:
          "Every tenant-scoped table enforces FORCE row-level security so that no role — including " +
          "the table owner — can read or write another tenant's rows.",
        crosswalk: [{ framework: "SOC2-TSC", reference: "CC6.1" }],
        evidence: [rlsFlaggedItem()],
        readiness: "gap",
      },
    ],
    summary: {
      totalControls: 2,
      controlsReady: 1,
      controlsWithGaps: 1,
      totalEvidenceItems: 3,
      posture:
        "1 of 2 controls evidence-ready; 1 gap recorded as a remediation item.",
    },
  };
}

/** A representative BLOCKED-case report — one unresolved control hard-blocks the whole pack. */
function sampleBlockedInput(): BlockedInput {
  return {
    ...commonMeta(),
    blocked: true,
    unresolved: [
      {
        controlId: "AVAILABILITY.BACKUP-RESTORE",
        collectorId: "substrate.worm-retention",
        reason:
          "no WORM retention term was found for the backup artifact class; evidence absent, status cannot be determined",
      },
    ],
  };
}

const sampleManifest = () => parseEvidencePackManifest(sampleManifestInput());
const sampleBlocked = () => parseEvidencePackBlocked(sampleBlockedInput());

/** Round-trip through JSON to a genuine `JsonValue` (drops `undefined`) so `canonicalize` accepts it. */
function asJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

/** Wrap a single evidence item into an otherwise-valid one-control manifest for negative tests. */
function manifestWithItem(item: unknown, readiness: string): unknown {
  return {
    ...manifestMeta(),
    crosswalkRollup: emptyRollup(),
    controls: [
      {
        controlId: "AUDIT.IMMUTABLE-LOG",
        title: "Immutable audit log",
        family: "Audit & Accountability",
        statement:
          "Security-relevant events are written to an append-only, hash-chained log.",
        crosswalk: [{ framework: "SOC2-TSC", reference: "CC7.2" }],
        evidence: [item],
        readiness,
      },
    ],
    summary: {
      totalControls: 1,
      controlsReady: readiness === "ready" ? 1 : 0,
      controlsWithGaps: readiness === "gap" ? 1 : 0,
      totalEvidenceItems: 1,
      posture: "1 control evaluated.",
    },
  };
}

describe("evidencePackManifestSchema — canonical body", () => {
  test("a representative manifest conforms to the .strict() format", () => {
    const m = sampleManifest();
    expect(m.formatVersion).toBe(EVIDENCE_PACK_FORMAT_VERSION);
    expect(m.controls).toHaveLength(2);
    expect(m.summary.totalEvidenceItems).toBe(3);
    expect(m.chainAnchor.tipHash).toBe(TIP);
  });

  test("rejects an injected timestamp (excluded from the canonical body)", () => {
    expect(() =>
      parseEvidencePackManifest({
        ...sampleManifestInput(),
        generatedAt: "2026-06-27T00:00:00.000Z",
      }),
    ).toThrow(ValidationError);
  });

  test("rejects an injected signature (excluded from the canonical body)", () => {
    expect(() =>
      parseEvidencePackManifest({
        ...sampleManifestInput(),
        signature: "ed25519:deadbeef",
      }),
    ).toThrow(ValidationError);
  });

  test("v2: crosswalkRollup is required (rejects a manifest with no rollup section)", () => {
    const { crosswalkRollup: _drop, ...withoutRollup } = sampleManifestInput();
    expect(() => parseEvidencePackManifest(withoutRollup)).toThrow(
      ValidationError,
    );
  });

  test("v2: an unknown key inside crosswalkRollup is rejected (.strict() boundary)", () => {
    expect(() =>
      parseEvidencePackManifest({
        ...sampleManifestInput(),
        crosswalkRollup: { cells: [], extra: true },
      }),
    ).toThrow(ValidationError);
  });

  test("rejects an unresolved evidence status (flag-never-guess, no partial pack)", () => {
    const item = { ...chainPassItem(), status: "unresolved" };
    expect(() =>
      parseEvidencePackManifest(manifestWithItem(item, "ready")),
    ).toThrow(ValidationError);
  });

  test("requires a recorded reason on a flagged item", () => {
    const item = rlsFlaggedItem();
    delete item.reason;
    expect(() =>
      parseEvidencePackManifest(manifestWithItem(item, "gap")),
    ).toThrow(ValidationError);
  });

  test("rejects a reason on a passing item", () => {
    const item = { ...chainPassItem(), reason: "should not be here" };
    expect(() =>
      parseEvidencePackManifest(manifestWithItem(item, "ready")),
    ).toThrow(ValidationError);
  });

  test("derives readiness from evidence (gap iff any item flagged)", () => {
    // A flagged item with readiness mistakenly asserted as "ready" must be rejected.
    expect(() =>
      parseEvidencePackManifest(manifestWithItem(rlsFlaggedItem(), "ready")),
    ).toThrow(ValidationError);
    // An all-pass control mistakenly marked "gap" must be rejected too.
    expect(() =>
      parseEvidencePackManifest(manifestWithItem(chainPassItem(), "gap")),
    ).toThrow(ValidationError);
  });

  test("rejects fabricated summary counts", () => {
    const input = sampleManifestInput();
    expect(() =>
      parseEvidencePackManifest({
        ...input,
        summary: { ...input.summary, totalControls: 99 },
      }),
    ).toThrow(ValidationError);
  });

  test('rejects posture copy that claims "compliant"/"certified"', () => {
    const input = sampleManifestInput();
    for (const posture of [
      "Your organization is fully compliant with SOC 2.",
      "This system is SOC 2 certified.",
    ]) {
      expect(() =>
        parseEvidencePackManifest({
          ...input,
          summary: { ...input.summary, posture },
        }),
      ).toThrow(ValidationError);
    }
  });

  test("rejects a non-finite number in evidence facts", () => {
    const item = {
      ...chainPassItem(),
      facts: { score: Number.POSITIVE_INFINITY },
    };
    expect(() =>
      parseEvidencePackManifest(manifestWithItem(item, "ready")),
    ).toThrow(ValidationError);
  });
});

describe("evidencePackBlockedSchema — BLOCKED case", () => {
  test("a representative blocked report conforms", () => {
    const b = sampleBlocked();
    expect(b.blocked).toBe(true);
    expect(b.unresolved).toHaveLength(1);
    expect(b.unresolved[0]?.controlId).toBe("AVAILABILITY.BACKUP-RESTORE");
  });

  test("requires at least one unresolved item", () => {
    expect(() =>
      parseEvidencePackBlocked({ ...sampleBlockedInput(), unresolved: [] }),
    ).toThrow(ValidationError);
  });

  test("rejects blocked: false (the report exists only to refuse)", () => {
    expect(() =>
      parseEvidencePackBlocked({ ...sampleBlockedInput(), blocked: false }),
    ).toThrow(ValidationError);
  });
});

describe("determinism contract (canonicalize)", () => {
  test("the canonical body is byte-stable and key-order independent", () => {
    const manifest = sampleManifest();
    const a = canonicalize(asJson(manifest));
    expect(canonicalize(asJson(manifest))).toBe(a);
    // Reordering top-level keys must not change the canonical bytes (the generator's pack sha256
    // must be stable regardless of object construction order).
    const reordered = Object.fromEntries(Object.entries(manifest).reverse());
    expect(canonicalize(asJson(reordered))).toBe(a);
  });

  test("the canonical body carries no attestation language", () => {
    expect(canonicalize(asJson(sampleManifest()))).not.toMatch(
      /compliant|certified/i,
    );
  });
});

describe("golden fixtures (BLESS unset)", () => {
  test("evidence-pack manifest body is byte-stable", () => {
    matchGolden(PKG_SRC_META, "evidence-pack.manifest", sampleManifest());
  });

  test("evidence-pack blocked report is byte-stable", () => {
    matchGolden(PKG_SRC_META, "evidence-pack.blocked", sampleBlocked());
  });
});
