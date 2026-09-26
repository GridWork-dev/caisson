import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson-sh/testing";
import { ValidationError } from "@caisson-sh/kernel";
import { iso27001Crosswalk, soc2Crosswalk } from "../crosswalks/regimes.ts";
import {
  computeIso27001SoaRows,
  type ControlEvidenceStatus,
} from "./iso-27001-soa.ts";

const PKG_SRC_META = new URL("../index.ts", import.meta.url).href;

/** The full set of crosswalked ISO/IEC 27001:2022 rows this repo ships, plus one control the
 *  crosswalk does NOT cover — exercises the flag-never-guess "unresolved" path. */
const SCOPE = [
  "A.5.15",
  "A.8.24",
  "A.8.10",
  "A.8.15",
  "A.8.16",
  "A.8.5",
  "A.5.37",
  "A.9.99", // no crosswalk row — must render applicable: "unresolved"
];

function statuses(): ReadonlyMap<string, ControlEvidenceStatus> {
  return new Map([
    ["ACCESS-CONTROL.LOGICAL", "ready"],
    ["DATA-PROTECTION.ENCRYPTION", "ready"],
    ["DATA-PROTECTION.DISPOSAL", "gap"],
    ["AUDIT.IMMUTABLE-LOG", "ready"],
    ["SYSTEM-OPERATIONS.DETECTION", "ready"],
    // AUTHENTICATION.ENTITY (A.8.5) deliberately absent — not evidenced this run.
    ["GOVERNANCE.DOCUMENTATION", "ready"],
  ]);
}

describe("computeIso27001SoaRows", () => {
  test("a control with no crosswalk row renders applicable: unresolved, never guessed", () => {
    const rows = computeIso27001SoaRows({
      controlIds: SCOPE,
      crosswalk: iso27001Crosswalk,
      controlStatuses: statuses(),
    });
    const row = rows.find((r) => r.control === "A.9.99");
    expect(row).toBeDefined();
    expect(row?.applicable).toBe("unresolved");
    expect(row?.status).toBe("unresolved");
    expect(row?.evidencePointer).toBeUndefined();
  });

  test("a crosswalked control with no evidenced status this run is unresolved, not assumed ready", () => {
    const rows = computeIso27001SoaRows({
      controlIds: SCOPE,
      crosswalk: iso27001Crosswalk,
      controlStatuses: statuses(),
    });
    const row = rows.find((r) => r.control === "A.8.5");
    expect(row?.applicable).toBe("applicable");
    expect(row?.evidencePointer).toBe("AUTHENTICATION.ENTITY");
    expect(row?.status).toBe("unresolved");
  });

  test("a crosswalked, evidenced control carries its derived status", () => {
    const rows = computeIso27001SoaRows({
      controlIds: SCOPE,
      crosswalk: iso27001Crosswalk,
      controlStatuses: statuses(),
    });
    const row = rows.find((r) => r.control === "A.8.10");
    expect(row?.applicable).toBe("applicable");
    expect(row?.status).toBe("gap");
    expect(row?.evidencePointer).toBe("DATA-PROTECTION.DISPOSAL");
  });

  test("deterministic: sorted + deduped regardless of input order", () => {
    const a = computeIso27001SoaRows({
      controlIds: SCOPE,
      crosswalk: iso27001Crosswalk,
      controlStatuses: statuses(),
    });
    const shuffled = [...SCOPE, "A.5.15", "A.8.5"].reverse();
    const b = computeIso27001SoaRows({
      controlIds: shuffled,
      crosswalk: iso27001Crosswalk,
      controlStatuses: statuses(),
    });
    expect(b).toEqual(a);
    expect(a.map((r) => r.control)).toEqual(
      [...a.map((r) => r.control)].sort(),
    );
  });

  test("fails closed on a non-ISO regime crosswalk", () => {
    expect(() =>
      computeIso27001SoaRows({
        controlIds: SCOPE,
        crosswalk: soc2Crosswalk,
        controlStatuses: statuses(),
      }),
    ).toThrow(ValidationError);
  });

  test("golden: byte-stable SoA rows", () => {
    const rows = computeIso27001SoaRows({
      controlIds: SCOPE,
      crosswalk: iso27001Crosswalk,
      controlStatuses: statuses(),
    });
    matchGolden(PKG_SRC_META, "iso-27001-soa", rows);
  });
});
