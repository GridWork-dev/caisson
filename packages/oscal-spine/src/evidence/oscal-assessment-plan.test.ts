// src/evidence/oscal-assessment-plan.test.ts — OSCAL v1.2.2 Assessment-Plan authoring (ADR-0231, ADR-0179 §B).
//
// The never-delivered ADR-0179 §B content: a real per-framework `assessment-plan` body. Tests assert the
// minimal-but-valid OSCAL shape (uuid + metadata + import-ssp + reviewed-controls), the locked oscal-version,
// the honest URN import-ssp (no dead HTTP URL), determinism under the injected clock + id seam, fail-closed
// on a bad clock, and a deterministic golden per framework (soc2 / hipaa / eu-ai-act).
import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson-sh/testing";
import {
  canonicalize,
  ValidationError,
  type JsonValue,
} from "@caisson-sh/kernel";
import type { OscalEvidencePackFramework } from "../contracts.ts";
import { OSCAL_VERSION } from "../contracts.ts";
import { toOscalAssessmentPlan } from "./oscal-assessment-plan.ts";

const PKG_SRC_META = new URL("../index.ts", import.meta.url).href;
const NOW = new Date("2026-06-28T00:00:00.000Z");
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SOC2: OscalEvidencePackFramework = {
  id: "soc2-tsc",
  title: "SOC 2 — Trust Services Criteria",
  version: "2024.1",
};
const HIPAA: OscalEvidencePackFramework = {
  id: "hipaa-security",
  title: "HIPAA Security Rule",
  version: "2024.1",
};
const EU_AI_ACT: OscalEvidencePackFramework = {
  id: "eu-ai-act",
  title: "EU AI Act — High-Risk Obligations",
  version: "2024.1",
};

const FRAMEWORKS: readonly {
  readonly slug: string;
  readonly framework: OscalEvidencePackFramework;
}[] = [
  { slug: "soc2", framework: SOC2 },
  { slug: "hipaa", framework: HIPAA },
  { slug: "eu-ai-act", framework: EU_AI_ACT },
];

/** A deterministic UUID source (a counter) — makes each AP byte-stable for golden fixturing. */
function counterIds(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  };
}

function det(): { now: Date; newId: () => string } {
  return { now: NOW, newId: counterIds() };
}

function asJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

describe("toOscalAssessmentPlan — OSCAL v1.2.2 assessment-plan authoring", () => {
  test("emits a wrapped assessment-plan with the required OSCAL fields", () => {
    const ap = toOscalAssessmentPlan(SOC2, det())["assessment-plan"];
    expect(ap.uuid).toMatch(UUID_RE);
    expect(ap.metadata["oscal-version"]).toBe(OSCAL_VERSION);
    expect(ap.metadata["last-modified"]).toBe(NOW.toISOString());
    expect(ap.metadata.version).toBe("2024.1");
    expect(ap.metadata.title).toBe(
      "Assessment Plan — SOC 2 — Trust Services Criteria",
    );
    // The framework-id prop carries the Caisson ns (research pitfall #4 — non-core props declare ns).
    expect(ap.metadata.props?.[0]).toEqual({
      name: "caisson-framework-id",
      ns: "https://caisson.sh/ns/oscal",
      value: "soc2-tsc",
    });
    expect(ap["reviewed-controls"]["control-selections"][0]).toEqual({
      "include-all": {},
    });
  });

  test("import-ssp is a stable Caisson URN, never a dead HTTP URL", () => {
    const ap = toOscalAssessmentPlan(SOC2, det())["assessment-plan"];
    expect(ap["import-ssp"].href).toBe(
      "urn:caisson:oscal:assessment-plan:no-ssp",
    );
    expect(ap["import-ssp"].href).not.toMatch(/^https?:\/\//);
  });

  test("deterministic under the injected clock + id seam (byte-identical)", () => {
    const a = toOscalAssessmentPlan(HIPAA, det());
    const b = toOscalAssessmentPlan(HIPAA, det());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(canonicalize(asJson(a))).toBe(canonicalize(asJson(b)));
  });

  test("the default id source mints a random UUID per call", () => {
    const a = toOscalAssessmentPlan(SOC2, { now: NOW })["assessment-plan"];
    const b = toOscalAssessmentPlan(SOC2, { now: NOW })["assessment-plan"];
    expect(a.uuid).toMatch(UUID_RE);
    expect(a.uuid).not.toBe(b.uuid);
  });

  test("fails closed on an invalid clock", () => {
    expect(() =>
      toOscalAssessmentPlan(SOC2, { now: new Date(Number.NaN) }),
    ).toThrow(ValidationError);
  });

  for (const fw of FRAMEWORKS) {
    test(`${fw.framework.id}: deterministic golden AP`, () => {
      const doc = toOscalAssessmentPlan(fw.framework, det());
      matchGolden(PKG_SRC_META, `oscal-assessment-plan-${fw.slug}`, doc);
    });
  }
});
