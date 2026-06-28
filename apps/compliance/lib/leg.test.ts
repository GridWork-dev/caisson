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
});

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

  test("the whole leg passes", () => {
    expect(result.allChecksPassed).toBe(true);
  });

  test("the evidence manifest is byte-stable against its golden fixture", () => {
    // The canonical body excludes the clock + signature, so a fixed (tenantId, now) is reproducible.
    expect(result.manifest.tenantId).toBe(DEMO_TENANT_ID);
    matchGolden(import.meta.url, "leg-evidence-pack", result.manifest);
  });

  test("re-running the leg on a fresh substrate yields the same byte-stable manifest", async () => {
    const second = await createLegHarness();
    try {
      const again = await runComplianceLeg(second, {
        tenantId: DEMO_TENANT_ID,
        now: DEMO_NOW,
      });
      expect(again.manifest).toEqual(result.manifest);
      expect(again.evidence.sha256).toBe(result.evidence.sha256);
    } finally {
      await second.cleanup();
    }
  });
});
