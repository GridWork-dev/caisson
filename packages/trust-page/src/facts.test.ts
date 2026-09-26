import { describe, expect, test } from "bun:test";
import { parseEvidencePackManifest } from "@caisson-sh/compliance-core";
import { DEFAULT_TRUST_PAGE_ALLOWLIST, flattenManifestFacts } from "./facts.ts";

function manifest() {
  return parseEvidencePackManifest({
    formatVersion: "2",
    tenantId: "tenant-acme",
    framework: {
      id: "soc2-tsc",
      title: "SOC 2 — Trust Services Criteria",
      version: "2024.1",
    },
    chainAnchor: { length: 3, tipHash: "a".repeat(64) },
    crosswalkRollup: { cells: [] },
    controls: [
      {
        controlId: "AUDIT.IMMUTABLE-LOG",
        title: "Immutable audit log",
        family: "Audit",
        statement: "append-only hash-chained log",
        crosswalk: [],
        evidence: [
          {
            collectorId: "substrate.chain-verify",
            title: "Audit chain verifies",
            summary: "the chain verifies against its anchor",
            status: "pass",
            facts: { valid: true },
            manualSlots: [],
          },
        ],
        readiness: "ready",
      },
    ],
    summary: {
      totalControls: 1,
      controlsReady: 1,
      controlsWithGaps: 0,
      totalEvidenceItems: 1,
      posture: "1 of 1 controls evidence-ready; no gaps recorded.",
    },
  });
}

describe("flattenManifestFacts", () => {
  test("flattens scalar manifest fields under dot-namespaced keys", () => {
    const facts = flattenManifestFacts(manifest());
    expect(facts["framework.title"]).toBe("SOC 2 — Trust Services Criteria");
    expect(facts["summary.totalControls"]).toBe(1);
    expect(facts.tenantId).toBe("tenant-acme");
    expect(facts["chainAnchor.tipHash"]).toBe("a".repeat(64));
  });

  test("flattens each control's id/title/readiness under an index", () => {
    const facts = flattenManifestFacts(manifest());
    expect(facts["controls.0.controlId"]).toBe("AUDIT.IMMUTABLE-LOG");
    expect(facts["controls.0.title"]).toBe("Immutable audit log");
    expect(facts["controls.0.readiness"]).toBe("ready");
  });
});

describe("DEFAULT_TRUST_PAGE_ALLOWLIST", () => {
  test("is minimal — excludes tenant id, raw hashes, and per-control detail", () => {
    expect(DEFAULT_TRUST_PAGE_ALLOWLIST).not.toContain("tenantId");
    expect(DEFAULT_TRUST_PAGE_ALLOWLIST).not.toContain("chainAnchor.tipHash");
    expect(
      DEFAULT_TRUST_PAGE_ALLOWLIST.some((k) => k.startsWith("controls.")),
    ).toBe(false);
    expect(
      DEFAULT_TRUST_PAGE_ALLOWLIST.some((k) => k.startsWith("crosswalkRollup")),
    ).toBe(false);
  });
});
