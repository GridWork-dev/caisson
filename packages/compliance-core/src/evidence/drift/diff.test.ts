import { describe, expect, test } from "bun:test";
import { diffSnapshots } from "./diff.ts";
import type { ComplianceSnapshot } from "./types.ts";

function baseSnapshot(): ComplianceSnapshot {
  return [
    {
      controlId: "AUDIT.IMMUTABLE-LOG",
      collectorId: "substrate.audit-chain-integrity",
      status: "pass",
    },
    {
      controlId: "DATA-PROTECTION.DISPOSAL",
      collectorId: "substrate.worm-retention-floor",
      status: "pass",
    },
  ];
}

describe("diffSnapshots — golden case", () => {
  test("mutating one control's evidence yields exactly one transition", () => {
    const previous = baseSnapshot();
    const current: ComplianceSnapshot = previous.map((row) =>
      row.controlId === "DATA-PROTECTION.DISPOSAL"
        ? {
            ...row,
            status: "flagged" as const,
            reason: "retain_until short of the legal floor",
          }
        : row,
    );

    const transitions = diffSnapshots(previous, current);

    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toEqual({
      controlId: "DATA-PROTECTION.DISPOSAL",
      collectorId: "substrate.worm-retention-floor",
      from: "pass",
      to: "flagged",
      toReason: "retain_until short of the legal floor",
    });
  });

  test("identical snapshots yield no transitions", () => {
    const snapshot = baseSnapshot();
    expect(diffSnapshots(snapshot, snapshot)).toEqual([]);
  });

  test("a newly-appearing collector transitions from absent", () => {
    const previous = baseSnapshot();
    const current: ComplianceSnapshot = [
      ...previous,
      {
        controlId: "RISK-MANAGEMENT.AI-LIFECYCLE",
        collectorId: "substrate.ai-risk-register",
        status: "pass",
      },
    ];
    const transitions = diffSnapshots(previous, current);
    expect(transitions).toEqual([
      {
        controlId: "RISK-MANAGEMENT.AI-LIFECYCLE",
        collectorId: "substrate.ai-risk-register",
        from: "absent",
        to: "pass",
      },
    ]);
  });

  test("a retired collector transitions to absent", () => {
    const previous = baseSnapshot();
    const current: ComplianceSnapshot = previous.filter(
      (row) => row.collectorId !== "substrate.audit-chain-integrity",
    );
    const transitions = diffSnapshots(previous, current);
    expect(transitions).toEqual([
      {
        controlId: "AUDIT.IMMUTABLE-LOG",
        collectorId: "substrate.audit-chain-integrity",
        from: "pass",
        to: "absent",
      },
    ]);
  });

  test("deterministic regardless of input row order", () => {
    const previous = baseSnapshot();
    const current: ComplianceSnapshot = previous.map((row) => ({
      ...row,
      status: "flagged" as const,
      reason: "reordered mutation",
    }));

    const forward = diffSnapshots(previous, [...current].reverse());
    const reversed = diffSnapshots([...previous].reverse(), current);
    expect(forward).toEqual(reversed);
    expect(forward.map((t) => t.controlId)).toEqual([
      "AUDIT.IMMUTABLE-LOG",
      "DATA-PROTECTION.DISPOSAL",
    ]);
  });
});
