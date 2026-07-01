// src/evidence/oscal-export-xml.test.ts — ADR-0180 XML converter path.
//
// The arg-builders are pure + always tested (they encode the `oscal-cli` contract). The JSON→XML→validate
// round-trip is the ground-truth NIST conformance gate but needs EXTERNAL `oscal-cli` (Java/Docker) — it
// SKIPS when the tool is absent so Java-less/credless CI stays green (env/availability guard, ADR-0180).
import { describe, expect, test } from "bun:test";
import {
  buildConvertArgs,
  buildValidateArgs,
  convertAndValidate,
  oscalCliAvailable,
  type OscalModel,
} from "./oscal-export-xml.ts";
import { toOscalBundle } from "./oscal-export.ts";
import { parseEvidencePackManifest } from "./pack-format.ts";

const HAVE_CLI = oscalCliAvailable();

describe("oscal-cli arg builders (pure, always run)", () => {
  test("convert args target the NIST json-to-xml XSLT via arg array (no shell)", () => {
    expect(
      buildConvertArgs("assessment-results", "/tmp/in.json", "/tmp/out.xml"),
    ).toEqual([
      "assessment-results",
      "convert",
      "--to=xml",
      "--overwrite",
      "/tmp/in.json",
      "/tmp/out.xml",
    ]);
    expect(buildConvertArgs("poam", "/tmp/in.json", "/tmp/out.xml")[0]).toBe(
      "poam",
    );
  });

  test("validate args name the model + path", () => {
    expect(buildValidateArgs("poam", "/tmp/out.xml")).toEqual([
      "poam",
      "validate",
      "/tmp/out.xml",
    ]);
  });

  test("availability probe returns a boolean, never throws", () => {
    expect(typeof HAVE_CLI).toBe("boolean");
  });
});

function sampleBundle(): ReturnType<typeof toOscalBundle> {
  const manifest = parseEvidencePackManifest({
    formatVersion: "1",
    tenantId: "tenant-acme-prod",
    framework: {
      id: "soc2-tsc",
      title: "SOC 2 — Trust Services Criteria",
      version: "2024.1",
    },
    chainAnchor: { length: 12, tipHash: "0a1b2c3d".repeat(8) },
    controls: [
      {
        controlId: "AUDIT.IMMUTABLE-LOG",
        title: "Immutable audit log",
        family: "Audit & Accountability",
        statement: "Append-only, hash-chained, WORM-anchored audit log.",
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
  let n = 0;
  return toOscalBundle(manifest, {
    now: new Date("2026-06-28T00:00:00.000Z"),
    newId: () =>
      `00000000-0000-4000-8000-${String((n += 1)).padStart(12, "0")}`,
  });
}

// Ground-truth NIST conformance — only when `oscal-cli` is installed. Skips otherwise (ADR-0180).
describe("JSON → XML → validate round-trip (needs external oscal-cli)", () => {
  const models: readonly [
    OscalModel,
    "assessmentResults" | "planOfActionAndMilestones",
  ][] = [
    ["assessment-results", "assessmentResults"],
    ["poam", "planOfActionAndMilestones"],
  ];
  for (const [model, key] of models) {
    test.skipIf(!HAVE_CLI)(
      `${model} converts + validates at v1.2.2`,
      async () => {
        const bundle = sampleBundle();
        const body = bundle[key];
        const xml = await convertAndValidate(model, body);
        expect(xml).toContain("<?xml");
      },
    );
  }
});
