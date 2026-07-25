import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { parseEvidencePackManifest } from "@caisson/compliance-core";
import type {
  LatestEvidencePackResponse,
  TenantProofResponse,
} from "@/lib/tenant-evidence";
import { TenantEvidenceDashboard } from "./tenant-evidence-dashboard";

const proof: TenantProofResponse = {
  receipt: {
    v: 1,
    seq: 7,
    hash: "a".repeat(64),
    prevHash: "b".repeat(64),
    anchor: {
      length: 8,
      tipHash: "a".repeat(64),
      genesisHash: "c".repeat(64),
    },
    raw: {
      prevHash: "b".repeat(64),
      payload: { token: "[REDACTED]" },
    },
    redacted: true,
    checks: {
      linkRecompute: "na",
      anchorEquality: "pass",
      signature: "na",
    },
    verifiedAt: "2026-07-25T20:00:00.000Z",
  },
  redacted: true,
  redactedPaths: ["token"],
  chainLength: 8,
};

function latestPack(): LatestEvidencePackResponse {
  return {
    kind: "latest-evidence-pack",
    sha256: "d".repeat(64),
    manifestSha256: "e".repeat(64),
    generatedAt: "2026-07-25T20:30:00.000Z",
    manifest: parseEvidencePackManifest({
      formatVersion: "2",
      tenantId: "acct_buyer_01",
      framework: {
        id: "soc2-tsc",
        title: "SOC 2 Trust Services Criteria",
        version: "2024.1",
      },
      chainAnchor: {
        length: 8,
        tipHash: "a".repeat(64),
        genesisHash: "c".repeat(64),
      },
      controls: [
        {
          controlId: "AUDIT.IMMUTABLE-LOG",
          title: "Immutable audit log",
          family: "Audit",
          statement: "Audit rows are anchored in write-once storage.",
          crosswalk: [],
          evidence: [
            {
              collectorId: "substrate.audit-chain-integrity",
              title: "Audit chain integrity",
              summary: "The chain matched its persisted anchor.",
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
        posture: "1 control is evidence-ready.",
      },
      crosswalkRollup: {
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
            reference: "CC7.2",
            canonicalControlIds: ["AUDIT.IMMUTABLE-LOG"],
            status: "ready",
            claim: "implements",
            evidencePointers: ["AUDIT.IMMUTABLE-LOG"],
          },
        ],
      },
    }),
  };
}

describe("TenantEvidenceDashboard", () => {
  test("renders an accessible proof lookup and redacted receipt", () => {
    const html = renderToStaticMarkup(
      <TenantEvidenceDashboard
        proof={proof}
        proofSeq={7}
        latestPack={latestPack()}
      />,
    );

    expect(html).toContain('<label for="audit-proof-seq">');
    expect(html).toContain('name="seq"');
    expect(html).toContain('aria-label="Redacted row proof receipt"');
    expect(html).toContain("[REDACTED]");
    expect(html).toContain("Original fields were redacted");
  });

  test("labels maps-to and implements as separate accessible edge sections with no coverage aggregate", () => {
    const html = renderToStaticMarkup(
      <TenantEvidenceDashboard latestPack={latestPack()} />,
    );

    expect(html).toContain('aria-labelledby="crosswalk-maps-to"');
    expect(html).toContain('id="crosswalk-maps-to"');
    expect(html).toContain(">Maps to</h2>");
    expect(html).toContain('aria-labelledby="crosswalk-implements"');
    expect(html).toContain('id="crosswalk-implements"');
    expect(html).toContain(">Implements</h2>");
    expect(html).toContain("HIPAA-Security");
    expect(html).toContain("SOC2-TSC");
    expect(html.toLowerCase()).not.toContain("coverage");
    expect(html).not.toContain("%");
  });

  test("announces an unverifiable proof and unavailable pack without fabricating a pass", () => {
    const html = renderToStaticMarkup(
      <TenantEvidenceDashboard
        proof={{ state: "unverifiable", reason: "anchor missing" }}
        proofSeq={2}
        latestPackError="No persisted evidence pack is available."
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Unverifiable");
    expect(html).toContain("anchor missing");
    expect(html).not.toContain("Verified");
  });
});
