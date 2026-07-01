// P2 exit-gate capstone: the Compliance reference app RUNS the full leg end to end over the
// test-doubled substrate (PGlite + a local WORM dir + derived keys + an in-memory sink) and proves
// the SPEC goal sentence — seed → encrypt under withTenantCrypto → lock to WORM + chain anchor →
// emit + validate a deterministic evidence pack → an unresolved flag blocks generation. No live
// cloud, no network (HOUSE RULE). The byte-stable manifest is golden-pinned (BLESS unset).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson/testing";
import { createLegHarness, type LegHarness } from "./harness";
import {
  DEMO_NOW,
  DEMO_TENANT_ID,
  runComplianceLeg,
  type LegResult,
} from "./leg";

let harness: LegHarness;
let result: LegResult;

beforeAll(async () => {
  harness = await createLegHarness();
  result = await runComplianceLeg(harness, {
    tenantId: DEMO_TENANT_ID,
    now: DEMO_NOW,
  });
}, 30_000); // PGlite + WORM + crypto + OSCAL leg exceeds bun's 5s default hook timeout on cold CI

afterAll(async () => {
  await harness.cleanup();
});

describe("compliance reference app — the full leg end to end", () => {
  test("1 — a SEC/HIPAA field round-trips under withTenantCrypto; a cross-row relocate fails (TM-E)", () => {
    expect(result.encryptedField.storedIsEnvelope).toBe(true);
    expect(result.encryptedField.keyVersion).toBe(1);
    expect(result.encryptedField.roundTrips).toBe(true);
    expect(result.encryptedField.crossRowRelocateRejected).toBe(true);
  });

  test("2 — an append-only versioned artifact locks into WORM with a verified chain anchor", () => {
    expect(result.wormLock.lockedVersionId.length).toBeGreaterThan(0);
    expect(result.wormLock.chainVerified).toBe(true);
    expect(result.wormLock.chainAnchor.length).toBe(1);
    expect(result.wormLock.chainAnchor.tipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.wormLock.meetsRetentionFloor).toBe(true);
    expect(result.wormLock.artifactKey.startsWith(`${DEMO_TENANT_ID}/`)).toBe(
      true,
    );
  });

  test("3 — the evidence pack is deterministic, format-valid, signed, and posture-honest", () => {
    expect(result.evidence.deterministic).toBe(true);
    expect(result.evidence.validatedAgainstFormat).toBe(true);
    expect(result.evidence.signatureValid).toBe(true);
    expect(result.evidence.controlCount).toBe(3);
    expect(result.evidence.controlsWithGaps).toBe(0);
    expect(result.evidence.sha256).toMatch(/^[0-9a-f]{64}$/);
    // Readiness copy only — never an attestation (ADR-0058 / TM-K).
    expect(result.evidence.posture).not.toMatch(/compliant|certified/i);
    expect(result.emittedEvents).toContain("evidence.generated");
  });

  test("4 — an unresolved control blocks generation with no partial pack (flag-never-guess, TM-K)", () => {
    expect(result.blocked.blocked).toBe(true);
    expect(result.blocked.unresolvedCount).toBe(1);
    expect(result.blocked.noPartialPack).toBe(true);
  });

  test("5 — a HIPAA-Security evidence pack is generated from the SAME 3 collector results, deterministic, format-valid, and signed", () => {
    expect(result.hipaaEvidence.framework).toBe("hipaa-security");
    expect(result.hipaaEvidence.deterministic).toBe(true);
    expect(result.hipaaEvidence.validatedAgainstFormat).toBe(true);
    expect(result.hipaaEvidence.signatureValid).toBe(true);
    expect(result.hipaaEvidence.controlCount).toBe(3);
    expect(result.hipaaEvidence.controlsWithGaps).toBe(0);
    expect(result.hipaaEvidence.sha256).toMatch(/^[0-9a-f]{64}$/);
    // Readiness copy only — never an attestation (ADR-0058 / TM-K).
    expect(result.hipaaEvidence.posture).not.toMatch(/compliant|certified/i);
    // A DIFFERENT pack than the SOC2 one (own framework id + own control ids → own hash).
    expect(result.hipaaEvidence.sha256).not.toBe(result.evidence.sha256);
  });

  test("6 — the SOC2 pack maps to a shape-correct, deterministic OSCAL v1.2.2 SAR+POA&M bundle (T15, map not push)", () => {
    const sar = result.oscal.assessmentResults["assessment-results"];
    const poam =
      result.oscal.planOfActionAndMilestones["plan-of-action-and-milestones"];
    expect(sar.results).toHaveLength(1);
    expect(sar.results[0]?.findings).toHaveLength(result.evidence.controlCount);
    // A clean (zero-gap) pack fabricates no remediation, but NIST XSD requires poam-items min-1, so it
    // carries ONE truthful "no open items" entry (not a made-up gap).
    expect(poam["poam-items"]).toHaveLength(1);
    expect(poam["poam-items"][0]?.title).toBe("No open remediation items");
    expect(poam["system-id"].id).toBe(DEMO_TENANT_ID);
  });

  test("the whole leg passes", () => {
    expect(result.allChecksPassed).toBe(true);
  });

  test("the evidence manifest is byte-stable against its golden fixture", () => {
    // The canonical body excludes the clock + signature, so a fixed (tenantId, now) is reproducible.
    expect(result.manifest.tenantId).toBe(DEMO_TENANT_ID);
    matchGolden(import.meta.url, "leg-evidence-pack", result.manifest);
  });

  test("the HIPAA evidence manifest is byte-stable against its golden fixture", () => {
    expect(result.hipaaManifest.tenantId).toBe(DEMO_TENANT_ID);
    expect(result.hipaaManifest.framework.id).toBe("hipaa-security");
    matchGolden(
      import.meta.url,
      "leg-evidence-pack-hipaa",
      result.hipaaManifest,
    );
  });

  test("the OSCAL export bundle is byte-stable against its golden fixture", () => {
    matchGolden(import.meta.url, "leg-oscal-bundle", result.oscal);
  });

  test("re-running the leg on a fresh substrate yields the same byte-stable manifests + OSCAL bundle", async () => {
    const second = await createLegHarness();
    try {
      const again = await runComplianceLeg(second, {
        tenantId: DEMO_TENANT_ID,
        now: DEMO_NOW,
      });
      expect(again.manifest).toEqual(result.manifest);
      expect(again.evidence.sha256).toBe(result.evidence.sha256);
      expect(again.hipaaManifest).toEqual(result.hipaaManifest);
      expect(again.hipaaEvidence.sha256).toBe(result.hipaaEvidence.sha256);
      expect(again.oscal).toEqual(result.oscal);
    } finally {
      await second.cleanup();
    }
  }, 30_000); // second full leg run — same cold-CI headroom as the beforeAll
});
