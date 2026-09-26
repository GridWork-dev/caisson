// src/evidence/crosswalk-rollup.test.ts — the cross-framework evidence rollup (ADR-0333/ADR-0347).
import { describe, expect, test } from "bun:test";
import {
  euAiAct,
  hipaaSecurity,
  regimeCrosswalks,
  soc2Tsc,
  type Framework,
} from "@caisson-sh/frameworks-pack";
import {
  computeCrosswalkRollup,
  controlStatusFromEvidence,
  crosswalkRollupCellSchema,
  type ControlStatus,
  type CrosswalkRollupCell,
} from "./crosswalk-rollup.ts";
import { flaggedResult, passResult, unresolvedResult } from "./collector.ts";

const CATALOGS: readonly Framework[] = [soc2Tsc, hipaaSecurity, euAiAct];

function statuses(
  entries: ReadonlyArray<readonly [string, ControlStatus]>,
): ReadonlyMap<string, ControlStatus> {
  return new Map(entries);
}

function cell(
  cells: readonly CrosswalkRollupCell[],
  framework: string,
  reference: string,
): CrosswalkRollupCell | undefined {
  return cells.find(
    (c) => c.framework === framework && c.reference === reference,
  );
}

describe("computeCrosswalkRollup — the fix-once-satisfied-across-N proof (§2a)", () => {
  test("GOVERNANCE.SECURITY-RESPONSIBILITY (soc2+hipaa) lights both frameworks' requirements", () => {
    const rollup = computeCrosswalkRollup({
      catalogs: CATALOGS,
      controlStatuses: statuses([
        ["GOVERNANCE.SECURITY-RESPONSIBILITY", "ready"],
      ]),
      regimeCrosswalks,
    });
    const soc2Cell = cell(rollup.cells, "SOC2-TSC", "CC1.3");
    const hipaaCell = cell(rollup.cells, "HIPAA-Security", "164.308(a)(2)");
    expect(soc2Cell?.status).toBe("ready");
    expect(hipaaCell?.status).toBe("ready");
    expect(soc2Cell?.canonicalControlIds).toEqual([
      "GOVERNANCE.SECURITY-RESPONSIBILITY",
    ]);
  });

  test("AUDIT.IMMUTABLE-LOG (soc2+eu-ai-act, same id reused verbatim) lights both frameworks", () => {
    const rollup = computeCrosswalkRollup({
      catalogs: CATALOGS,
      controlStatuses: statuses([["AUDIT.IMMUTABLE-LOG", "ready"]]),
      regimeCrosswalks,
    });
    expect(cell(rollup.cells, "SOC2-TSC", "CC4.1")?.status).toBe("ready");
    expect(cell(rollup.cells, "SOC2-TSC", "CC7.2")?.status).toBe("ready");
    expect(cell(rollup.cells, "EU-AI-Act", "Art. 12")?.status).toBe("ready");
    expect(cell(rollup.cells, "HIPAA-Security", "164.312(b)")?.status).toBe(
      "ready",
    );
  });

  test("GOVERNANCE.DOCUMENTATION (hipaa+eu-ai-act, same id reused verbatim) lights both frameworks", () => {
    const rollup = computeCrosswalkRollup({
      catalogs: CATALOGS,
      controlStatuses: statuses([["GOVERNANCE.DOCUMENTATION", "gap"]]),
      regimeCrosswalks,
    });
    expect(cell(rollup.cells, "HIPAA-Security", "164.316(a)")?.status).toBe(
      "gap",
    );
    expect(cell(rollup.cells, "EU-AI-Act", "Art. 18")?.status).toBe("gap");
  });
});

describe("computeCrosswalkRollup — the SPEC's marquee verification scenario", () => {
  test("an rls-force pass (ACCESS-CONTROL.LOGICAL ready) yields maps-to on CC6.1/CC6.2/CC6.3", () => {
    const rollup = computeCrosswalkRollup({
      catalogs: CATALOGS,
      controlStatuses: statuses([["ACCESS-CONTROL.LOGICAL", "ready"]]),
      regimeCrosswalks,
    });
    for (const ref of ["CC6.1", "CC6.2", "CC6.3"]) {
      const c = cell(rollup.cells, "SOC2-TSC", ref);
      expect(c?.status).toBe("ready");
      expect(c?.claim).toBe("maps-to");
    }
  });
});

describe("computeCrosswalkRollup — Fork E claim posture (restates, never originates)", () => {
  test("a ready + reviewed + regime-implements reference (real C1.2 record) yields implements", () => {
    const rollup = computeCrosswalkRollup({
      catalogs: CATALOGS,
      controlStatuses: statuses([["DATA-PROTECTION.DISPOSAL", "ready"]]),
      regimeCrosswalks,
    });
    const implementsCell = cell(rollup.cells, "SOC2-TSC", "C1.2");
    expect(implementsCell?.claim).toBe("implements");
    expect(implementsCell?.status).toBe("ready");
  });

  test("the SAME control's unreviewed sibling reference stays maps-to (per-reference, not per-control)", () => {
    const rollup = computeCrosswalkRollup({
      catalogs: CATALOGS,
      controlStatuses: statuses([["DATA-PROTECTION.DISPOSAL", "ready"]]),
      regimeCrosswalks,
    });
    expect(cell(rollup.cells, "SOC2-TSC", "CC6.5")?.claim).toBe("maps-to");
  });

  test("a gap control never reaches implements even with a reviewed reference", () => {
    const rollup = computeCrosswalkRollup({
      catalogs: CATALOGS,
      controlStatuses: statuses([["DATA-PROTECTION.DISPOSAL", "gap"]]),
      regimeCrosswalks,
    });
    expect(cell(rollup.cells, "SOC2-TSC", "C1.2")?.claim).toBe("maps-to");
    expect(cell(rollup.cells, "SOC2-TSC", "C1.2")?.status).toBe("gap");
  });

  test("no matching regime row (HIPAA/EU-AI-Act have none) always defaults maps-to", () => {
    const rollup = computeCrosswalkRollup({
      catalogs: CATALOGS,
      controlStatuses: statuses([["AUDIT.IMMUTABLE-LOG", "ready"]]),
      regimeCrosswalks,
    });
    expect(cell(rollup.cells, "HIPAA-Security", "164.312(b)")?.claim).toBe(
      "maps-to",
    );
    expect(cell(rollup.cells, "EU-AI-Act", "Art. 12")?.claim).toBe("maps-to");
  });

  test("an unresolved control status propagates unresolved to every cell it contributes to", () => {
    const rollup = computeCrosswalkRollup({
      catalogs: CATALOGS,
      controlStatuses: statuses([["AUDIT.IMMUTABLE-LOG", "unresolved"]]),
      regimeCrosswalks,
    });
    expect(cell(rollup.cells, "SOC2-TSC", "CC7.2")?.status).toBe("unresolved");
    expect(cell(rollup.cells, "SOC2-TSC", "CC7.2")?.claim).toBe("maps-to");
  });

  test("a control absent from controlStatuses (not evidenced this run) contributes no cell", () => {
    const rollup = computeCrosswalkRollup({
      catalogs: CATALOGS,
      controlStatuses: statuses([]),
      regimeCrosswalks,
    });
    expect(rollup.cells).toEqual([]);
  });
});

describe("computeCrosswalkRollup — OLIR seed note attachment", () => {
  test("a reference verification citing the OLIR seed id attaches the subjective/incomplete note", () => {
    const withOlirSeed: Framework = {
      ...soc2Tsc,
      controls: [
        {
          ...soc2Tsc.controls[0]!,
          id: "TEST.OLIR-SEEDED",
          crosswalk: [
            {
              framework: "ISO-27001",
              reference: "A.5.1",
              verification: {
                status: "reviewed",
                relationship: "related",
                sourceId: "nist-sp800-53r5-iso27001-2022-olir",
                sourceVersion: "2022",
                sourceDigest: "d".repeat(64),
                reviewedBy: "operator",
                reviewedAt: "2026-07-13T00:00:00.000Z",
              },
            },
          ],
        },
      ],
    };
    const rollup = computeCrosswalkRollup({
      catalogs: [withOlirSeed],
      controlStatuses: statuses([["TEST.OLIR-SEEDED", "ready"]]),
      regimeCrosswalks,
    });
    expect(cell(rollup.cells, "ISO-27001", "A.5.1")?.note).toContain(
      "subjective, incomplete",
    );
  });
});

describe("computeCrosswalkRollup — ISO 27001 fourth view (ADR-0347 Fork G1, canonicalControlId join)", () => {
  test("an rls-force pass ALSO lights the ISO A.5.15 row via ACCESS-CONTROL.LOGICAL's canonicalControlId", () => {
    const rollup = computeCrosswalkRollup({
      catalogs: CATALOGS,
      controlStatuses: statuses([["ACCESS-CONTROL.LOGICAL", "ready"]]),
      regimeCrosswalks,
    });
    const isoCell = cell(rollup.cells, "ISO-27001", "A.5.15");
    expect(isoCell?.status).toBe("ready");
    expect(isoCell?.claim).toBe("maps-to");
    expect(isoCell?.canonicalControlIds).toEqual(["ACCESS-CONTROL.LOGICAL"]);
  });

  test("the ISO cell's status tracks the joined control's status (gap propagates)", () => {
    const rollup = computeCrosswalkRollup({
      catalogs: CATALOGS,
      controlStatuses: statuses([["AUDIT.IMMUTABLE-LOG", "gap"]]),
      regimeCrosswalks,
    });
    expect(cell(rollup.cells, "ISO-27001", "A.8.15")?.status).toBe("gap");
  });

  test("the ISO cell carries the OLIR seed note from the crosswalk's seedProvenance", () => {
    const rollup = computeCrosswalkRollup({
      catalogs: CATALOGS,
      controlStatuses: statuses([["DATA-PROTECTION.ENCRYPTION", "ready"]]),
      regimeCrosswalks,
    });
    expect(cell(rollup.cells, "ISO-27001", "A.8.24")?.note).toContain(
      "subjective, incomplete",
    );
  });

  test("a canonicalControlId absent from controlStatuses contributes no ISO cell", () => {
    const rollup = computeCrosswalkRollup({
      catalogs: CATALOGS,
      controlStatuses: statuses([]),
      regimeCrosswalks,
    });
    expect(cell(rollup.cells, "ISO-27001", "A.5.15")).toBeUndefined();
  });

  test("Legal gate (ADR-0333): an ISO cell never renders implements, even at maximum optimism", () => {
    // Every canonical control an ISO row joins to is `ready` here -- the most favorable input the
    // rollup could ever see for that cell. It must still be `maps-to`: an ISO-driven contribution
    // never carries a `verification` record (no per-row provenance exists on RegimeCrosswalkRow), so
    // Fork E condition (b) can never hold, structurally, regardless of control readiness.
    const rollup = computeCrosswalkRollup({
      catalogs: CATALOGS,
      controlStatuses: statuses([
        ["ACCESS-CONTROL.LOGICAL", "ready"],
        ["DATA-PROTECTION.ENCRYPTION", "ready"],
        ["DATA-PROTECTION.DISPOSAL", "ready"],
        ["AUDIT.IMMUTABLE-LOG", "ready"],
        ["SYSTEM-OPERATIONS.DETECTION", "ready"],
        ["AUTHENTICATION.ENTITY", "ready"],
        ["GOVERNANCE.DOCUMENTATION", "ready"],
      ]),
      regimeCrosswalks,
    });
    const isoCells = rollup.cells.filter((c) => c.framework === "ISO-27001");
    expect(isoCells.length).toBeGreaterThan(0);
    for (const c of isoCells) {
      expect(c.claim).toBe("maps-to");
    }
  });
});

describe("computeCrosswalkRollup — NIST SP 800-53 fifth view (oscal-spine SPEC, task 4)", () => {
  // Mirrors the ISO 27001 fourth-view block above exactly — the generalized loop must treat every
  // canonicalControlId-carrying regime crosswalk identically, not special-case ISO.
  test("an rls-force pass ALSO lights the NIST AC-3/AC-6 rows via ACCESS-CONTROL.LOGICAL's canonicalControlId", () => {
    const rollup = computeCrosswalkRollup({
      catalogs: CATALOGS,
      controlStatuses: statuses([["ACCESS-CONTROL.LOGICAL", "ready"]]),
      regimeCrosswalks,
    });
    const ac3 = cell(rollup.cells, "NIST-800-53", "AC-3");
    const ac6 = cell(rollup.cells, "NIST-800-53", "AC-6");
    expect(ac3?.status).toBe("ready");
    expect(ac3?.claim).toBe("maps-to");
    expect(ac3?.canonicalControlIds).toEqual(["ACCESS-CONTROL.LOGICAL"]);
    expect(ac6?.status).toBe("ready");
  });

  test("the NIST cell's status tracks the joined control's status (gap propagates)", () => {
    const rollup = computeCrosswalkRollup({
      catalogs: CATALOGS,
      controlStatuses: statuses([["AUDIT.IMMUTABLE-LOG", "gap"]]),
      regimeCrosswalks,
    });
    expect(cell(rollup.cells, "NIST-800-53", "AU-9")?.status).toBe("gap");
  });

  test("a canonicalControlId absent from controlStatuses contributes no NIST cell", () => {
    const rollup = computeCrosswalkRollup({
      catalogs: CATALOGS,
      controlStatuses: statuses([]),
      regimeCrosswalks,
    });
    expect(cell(rollup.cells, "NIST-800-53", "AC-3")).toBeUndefined();
  });

  test("Legal gate: an NIST-800-53 cell never renders implements, even at maximum optimism", () => {
    const rollup = computeCrosswalkRollup({
      catalogs: CATALOGS,
      controlStatuses: statuses([
        ["ACCESS-CONTROL.LOGICAL", "ready"],
        ["AUDIT.IMMUTABLE-LOG", "ready"],
        ["DATA-PROTECTION.ENCRYPTION", "ready"],
        ["DATA-PROTECTION.INTEGRITY", "ready"],
        ["SYSTEM-OPERATIONS.DETECTION", "ready"],
        ["AUTHENTICATION.ENTITY", "ready"],
        ["DATA-PROTECTION.DISPOSAL", "ready"],
      ]),
      regimeCrosswalks,
    });
    const nistCells = rollup.cells.filter((c) => c.framework === "NIST-800-53");
    expect(nistCells.length).toBeGreaterThan(0);
    for (const c of nistCells) {
      expect(c.claim).toBe("maps-to");
    }
  });

  test("NIST-800-53 cells carry no OLIR-seed note (own-authored, not third-party-seeded)", () => {
    const rollup = computeCrosswalkRollup({
      catalogs: CATALOGS,
      controlStatuses: statuses([["ACCESS-CONTROL.LOGICAL", "ready"]]),
      regimeCrosswalks,
    });
    expect(cell(rollup.cells, "NIST-800-53", "AC-3")?.note).toBeUndefined();
  });

  test("ISO and NIST views coexist — the same canonicalControlId lights both, distinct references", () => {
    const rollup = computeCrosswalkRollup({
      catalogs: CATALOGS,
      controlStatuses: statuses([["AUDIT.IMMUTABLE-LOG", "ready"]]),
      regimeCrosswalks,
    });
    expect(cell(rollup.cells, "ISO-27001", "A.8.15")?.status).toBe("ready");
    expect(cell(rollup.cells, "NIST-800-53", "AU-2")?.status).toBe("ready");
    expect(cell(rollup.cells, "NIST-800-53", "AU-9")?.status).toBe("ready");
    expect(cell(rollup.cells, "NIST-800-53", "AU-11")?.status).toBe("ready");
  });
});

describe("computeCrosswalkRollup — determinism", () => {
  test("cells are sorted (framework, reference) regardless of catalogs input order", () => {
    const a = computeCrosswalkRollup({
      catalogs: [soc2Tsc, hipaaSecurity, euAiAct],
      controlStatuses: statuses([
        ["AUDIT.IMMUTABLE-LOG", "ready"],
        ["GOVERNANCE.DOCUMENTATION", "ready"],
      ]),
      regimeCrosswalks,
    });
    const b = computeCrosswalkRollup({
      catalogs: [euAiAct, soc2Tsc, hipaaSecurity],
      controlStatuses: statuses([
        ["GOVERNANCE.DOCUMENTATION", "ready"],
        ["AUDIT.IMMUTABLE-LOG", "ready"],
      ]),
      regimeCrosswalks,
    });
    expect(a).toEqual(b);
    const refs = a.cells.map((c) => `${c.framework} ${c.reference}`);
    expect(refs).toEqual([...refs].sort());
  });
});

describe("Legal-gate copy guard (ADR-0080 / ADR-0333 Group G) -- rollup note is readiness language only", () => {
  function cellInput(
    note: string,
  ): Parameters<typeof crosswalkRollupCellSchema.parse>[0] {
    return {
      framework: "ISO-27001",
      reference: "A.5.15",
      canonicalControlIds: ["ACCESS-CONTROL.LOGICAL"],
      status: "ready",
      claim: "maps-to",
      evidencePointers: ["ACCESS-CONTROL.LOGICAL"],
      note,
    };
  }

  test("a note using neutral readiness language parses", () => {
    expect(() =>
      crosswalkRollupCellSchema.parse(
        cellInput("Seeded from a public-domain mapping; check data only."),
      ),
    ).not.toThrow();
  });

  for (const forbidden of ["compliant", "certified", "verified"]) {
    test(`a note claiming "${forbidden}" is rejected`, () => {
      expect(() =>
        crosswalkRollupCellSchema.parse(
          cellInput(`This mapping means the buyer is ${forbidden}.`),
        ),
      ).toThrow();
    });
  }
});

describe("controlStatusFromEvidence — worst-of a control's gathered evidence", () => {
  const item = {
    collectorId: "substrate.x",
    controlId: "X",
    title: "t",
    summary: "s",
    facts: {},
    manualSlots: [],
  };

  test("all pass -> ready", () => {
    expect(
      controlStatusFromEvidence([passResult(item), passResult(item)]),
    ).toBe("ready");
  });

  test("any flagged -> gap", () => {
    expect(
      controlStatusFromEvidence([passResult(item), flaggedResult(item, "r")]),
    ).toBe("gap");
  });

  test("any unresolved -> unresolved, even alongside a flagged item", () => {
    expect(
      controlStatusFromEvidence([
        flaggedResult(item, "r"),
        unresolvedResult(item, "missing"),
      ]),
    ).toBe("unresolved");
  });

  test("no evidence -> ready (vacuously — the caller decides whether an empty control is meaningful)", () => {
    expect(controlStatusFromEvidence([])).toBe("ready");
  });
});
