// src/evidence/oscal-iso27001-soa.test.ts — OSCAL `component-definition` export of the ISO/IEC
// 27001:2022 Statement of Applicability.
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { matchGolden } from "@caisson-sh/testing";
import { ValidationError } from "@caisson-sh/kernel";
import {
  buildValidateArgs,
  ISO27001_SOA_SOURCE_URN,
  OSCAL_VERSION,
  oscalCliAvailable,
  toOscalIso27001Soa,
  type OscalIso27001SoaOptions,
} from "@caisson-sh/oscal-spine";
import {
  computeIso27001SoaRows,
  iso27001Crosswalk,
  type SoaRow,
} from "@caisson-sh/frameworks-pack";

const PKG_SRC_META = new URL("../../oscal-spine/src/index.ts", import.meta.url)
  .href;
const NOW = new Date("2026-07-19T00:00:00.000Z");
const HAVE_CLI = oscalCliAvailable();

function counterIds(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  };
}

function det(
  overrides?: Partial<OscalIso27001SoaOptions>,
): OscalIso27001SoaOptions {
  return {
    now: NOW,
    newId: counterIds(),
    title: "Caisson ISO/IEC 27001:2022 Statement of Applicability",
    version: "2026.1",
    ...overrides,
  };
}

/** Every control the shipped ISO/IEC 27001:2022 crosswalk covers, plus one out-of-scope control the
 *  crosswalk does NOT map — exercises the flag-never-guess "unresolved" row end to end. */
function rows(): SoaRow[] {
  const controlStatuses = new Map(
    iso27001Crosswalk.rows
      .filter((row) => row.canonicalControlId !== undefined)
      .map((row, i) => [
        row.canonicalControlId as string,
        i === 0 ? ("gap" as const) : ("ready" as const),
      ]),
  );
  return computeIso27001SoaRows({
    controlIds: [...iso27001Crosswalk.rows.map((row) => row.control), "A.9.99"],
    crosswalk: iso27001Crosswalk,
    controlStatuses,
  });
}

describe("toOscalIso27001Soa — component-definition shape", () => {
  test("emits a wrapped component-definition document with required metadata", () => {
    const doc = toOscalIso27001Soa(rows(), det());
    const body = doc["component-definition"];
    expect(body.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(body.metadata.title).toBe(
      "Caisson ISO/IEC 27001:2022 Statement of Applicability",
    );
    expect(body.metadata["oscal-version"]).toBe(OSCAL_VERSION);
    expect(body.metadata["last-modified"]).toBe(NOW.toISOString());
  });

  test("one implemented-requirement per row, control-id preserved, source is a stable URN", () => {
    const doc = toOscalIso27001Soa(rows(), det());
    const impl =
      doc["component-definition"].components[0]?.["control-implementations"][0];
    expect(impl?.source).toBe(ISO27001_SOA_SOURCE_URN);
    const ids = impl?.["implemented-requirements"].map((r) => r["control-id"]);
    expect(ids).toEqual(rows().map((r) => r.control));
  });

  test("the unresolved (no-crosswalk-row) control carries unresolved applicability + status props", () => {
    const doc = toOscalIso27001Soa(rows(), det());
    const impl =
      doc["component-definition"].components[0]?.["control-implementations"][0];
    const req = impl?.["implemented-requirements"].find(
      (r) => r["control-id"] === "A.9.99",
    );
    expect(req?.props).toEqual([
      {
        name: "caisson-soa-applicability",
        ns: "https://caisson.sh/ns/oscal",
        value: "unresolved",
      },
      {
        name: "caisson-soa-status",
        ns: "https://caisson.sh/ns/oscal",
        value: "unresolved",
      },
    ]);
    // No caisson-evidence-pointer prop — there is nothing to point to.
    expect(req?.props.some((p) => p.name === "caisson-evidence-pointer")).toBe(
      false,
    );
  });

  test("a resolved row carries its evidence-pointer prop", () => {
    const doc = toOscalIso27001Soa(rows(), det());
    const impl =
      doc["component-definition"].components[0]?.["control-implementations"][0];
    const req = impl?.["implemented-requirements"].find(
      (r) => r["control-id"] === "A.5.15",
    );
    expect(req?.props).toContainEqual({
      name: "caisson-evidence-pointer",
      ns: "https://caisson.sh/ns/oscal",
      value: "ACCESS-CONTROL.LOGICAL",
    });
  });

  test("requirements are sorted by control id regardless of row input order", () => {
    const a = toOscalIso27001Soa(rows(), det());
    const b = toOscalIso27001Soa([...rows()].reverse(), det());
    expect(a).toEqual(b);
    const impl =
      a["component-definition"].components[0]?.["control-implementations"][0];
    const ids = impl?.["implemented-requirements"].map((r) => r["control-id"]);
    expect(ids).toEqual([...(ids ?? [])].sort());
  });

  test("fails closed on an invalid clock", () => {
    expect(() =>
      toOscalIso27001Soa(rows(), det({ now: new Date(Number.NaN) })),
    ).toThrow(ValidationError);
  });

  test("fails closed on an empty row set", () => {
    expect(() => toOscalIso27001Soa([], det())).toThrow(ValidationError);
  });

  test("fails closed on a banned-claim-word title (WR-01)", () => {
    expect(() =>
      toOscalIso27001Soa(
        rows(),
        det({
          title:
            "Caisson ISO/IEC 27001:2022 certified Statement of Applicability",
        }),
      ),
    ).toThrow(ValidationError);
  });

  test("no title/description/prop value claims compliant/certified/verified (ADR-0080)", () => {
    const doc = toOscalIso27001Soa(rows(), det());
    const forbidden = /\b(compliant|certified|verified)\b/i;
    const body = doc["component-definition"];
    expect(body.metadata.title).not.toMatch(forbidden);
    for (const component of body.components) {
      expect(component.title).not.toMatch(forbidden);
      expect(component.description).not.toMatch(forbidden);
      for (const impl of component["control-implementations"]) {
        expect(impl.description).not.toMatch(forbidden);
        for (const req of impl["implemented-requirements"]) {
          expect(req.description).not.toMatch(forbidden);
        }
      }
    }
  });

  test("byte-stable golden", () => {
    matchGolden(
      PKG_SRC_META,
      "oscal-iso27001-soa.component-definition",
      toOscalIso27001Soa(rows(), det()),
    );
  });
});

describe("toOscalIso27001Soa — ground-truth NIST schema validation", () => {
  test.skipIf(!HAVE_CLI)(
    "validates against oscal-cli at the locked v1.2.2 schema (JSON, schema-only)",
    () => {
      const doc = toOscalIso27001Soa(rows(), det());
      const dir = mkdtempSync(join(tmpdir(), "caisson-oscal-soa-"));
      const file = join(dir, "component-definition.json");
      try {
        writeFileSync(file, JSON.stringify(doc));
        // Arg array, never a shell string (security floor) — mirrors buildValidateArgs' own contract.
        execFileSync("oscal-cli", [...buildValidateArgs(file)], {
          stdio: "pipe",
          timeout: 60_000,
        });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});
