// src/index.test.ts — public export-surface regression pin. `loadVendoredNistControlIds` does
// I/O relative to its own module file and ENOENTs from a built dist/ tree (bare tsc ships no
// JSON copy) — it must stay a package-internal test/re-vendor-script helper, never part of the
// published barrel (SHIP-audit P2 fix, oscal-spine). This catches a future accidental re-widening.
import { describe, expect, test } from "bun:test";
import * as oscalSpine from "@caisson-sh/oscal-spine";
import type {
  NistCatalogDocument as SpineNistCatalogDocument,
  OscalAssessmentPlan as SpineOscalAssessmentPlan,
  OscalCatalogDocument as SpineOscalCatalogDocument,
  OscalDeliveryConfig as SpineOscalDeliveryConfig,
  OscalEvidencePackManifest as SpineOscalEvidencePackManifest,
  OscalExportBundle as SpineOscalExportBundle,
  OscalIso27001SoaDocument as SpineOscalIso27001SoaDocument,
  RegimeCrosswalk as SpineRegimeCrosswalk,
} from "@caisson-sh/oscal-spine";
import type {
  NistCatalogDocument as ParentNistCatalogDocument,
  OscalAssessmentPlan as ParentOscalAssessmentPlan,
  OscalCatalogDocument as ParentOscalCatalogDocument,
  OscalDeliveryConfig as ParentOscalDeliveryConfig,
  OscalEvidencePackManifest as ParentOscalEvidencePackManifest,
  OscalExportBundle as ParentOscalExportBundle,
  OscalIso27001SoaDocument as ParentOscalIso27001SoaDocument,
  RegimeCrosswalk as ParentRegimeCrosswalk,
} from "./index.ts";
import * as pkg from "./index.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Assert<T extends true> = T;
type SpineTypes = [
  SpineNistCatalogDocument,
  SpineOscalAssessmentPlan,
  SpineOscalCatalogDocument,
  SpineOscalDeliveryConfig,
  SpineOscalEvidencePackManifest,
  SpineOscalExportBundle,
  SpineOscalIso27001SoaDocument,
  SpineRegimeCrosswalk,
];
type ParentTypes = [
  ParentNistCatalogDocument,
  ParentOscalAssessmentPlan,
  ParentOscalCatalogDocument,
  ParentOscalDeliveryConfig,
  ParentOscalEvidencePackManifest,
  ParentOscalExportBundle,
  ParentOscalIso27001SoaDocument,
  ParentRegimeCrosswalk,
];
const TYPE_SURFACE_IS_IDENTICAL: Assert<Equal<SpineTypes, ParentTypes>> = true;

describe("public export surface — the vendored-catalog I/O helper stays out of the barrel", () => {
  test("loadVendoredNistControlIds is NOT exported from the package root", () => {
    expect("loadVendoredNistControlIds" in pkg).toBe(false);
  });

  test("the pure extractControlIds IS exported (no I/O, safe in every runtime)", () => {
    expect(typeof (pkg as Record<string, unknown>).extractControlIds).toBe(
      "function",
    );
  });

  test("the parent re-exports the whole OSCAL package surface unchanged", () => {
    for (const [name, value] of Object.entries(oscalSpine)) {
      expect(
        (pkg as Record<string, unknown>)[name],
        `missing or replaced OSCAL runtime export: ${name}`,
      ).toBe(value);
    }
  });

  test("representative type-only exports remain exactly compatible", () => {
    expect(TYPE_SURFACE_IS_IDENTICAL).toBe(true);
  });
});
