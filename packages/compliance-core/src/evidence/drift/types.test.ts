import { describe, expect, test } from "bun:test";
import { flaggedResult, passResult } from "../collector.ts";
import { generateEvidencePack } from "../generate.ts";
import { snapshotFromManifest } from "./types.ts";

describe("snapshotFromManifest", () => {
  test("projects one row per (controlId, collectorId), sorted, reason only on flagged", () => {
    const pack = generateEvidencePack({
      tenantId: "tenant-x",
      framework: { id: "soc2-tsc", title: "SOC 2", version: "2024.1" },
      chainAnchor: { length: 1, tipHash: "a".repeat(64) },
      crosswalkRollup: { cells: [] },
      controls: [
        {
          controlId: "AUDIT.IMMUTABLE-LOG",
          title: "Immutable audit log",
          family: "Audit",
          statement: "s",
          crosswalk: [],
          evidence: [
            passResult({
              collectorId: "substrate.audit-chain-integrity",
              controlId: "AUDIT.IMMUTABLE-LOG",
              title: "t",
              summary: "s",
              facts: {},
              manualSlots: [],
            }),
          ],
        },
        {
          controlId: "DATA-PROTECTION.DISPOSAL",
          title: "Data disposal",
          family: "Data Protection",
          statement: "s",
          crosswalk: [],
          evidence: [
            flaggedResult(
              {
                collectorId: "substrate.worm-retention-floor",
                controlId: "DATA-PROTECTION.DISPOSAL",
                title: "t",
                summary: "s",
                facts: {},
                manualSlots: [],
              },
              "short of the floor",
            ),
          ],
        },
      ],
      now: new Date("2026-08-01T00:00:00.000Z"),
    });

    const snapshot = snapshotFromManifest(pack.manifest);
    expect(snapshot).toEqual([
      {
        controlId: "AUDIT.IMMUTABLE-LOG",
        collectorId: "substrate.audit-chain-integrity",
        status: "pass",
      },
      {
        controlId: "DATA-PROTECTION.DISPOSAL",
        collectorId: "substrate.worm-retention-floor",
        status: "flagged",
        reason: "short of the floor",
      },
    ]);
  });
});
