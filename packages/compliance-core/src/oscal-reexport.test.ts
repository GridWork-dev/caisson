import { describe, expect, test } from "bun:test";
import * as oscalSpine from "@caisson/oscal-spine";
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
import * as complianceCore from "./index.ts";
import type {
  NistCatalogDocument as SpineNistCatalogDocument,
  OscalAssessmentPlan as SpineOscalAssessmentPlan,
  OscalCatalogDocument as SpineOscalCatalogDocument,
  OscalDeliveryConfig as SpineOscalDeliveryConfig,
  OscalEvidencePackManifest as SpineOscalEvidencePackManifest,
  OscalExportBundle as SpineOscalExportBundle,
  OscalIso27001SoaDocument as SpineOscalIso27001SoaDocument,
  RegimeCrosswalk as SpineRegimeCrosswalk,
} from "@caisson/oscal-spine";

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

describe("@caisson/compliance-core OSCAL compatibility surface", () => {
  test("re-exports the whole OSCAL package surface unchanged", () => {
    for (const [name, value] of Object.entries(oscalSpine)) {
      expect(
        (complianceCore as Record<string, unknown>)[name],
        `missing or replaced OSCAL runtime export: ${name}`,
      ).toBe(value);
    }
  });

  test("representative type-only exports remain exactly compatible", () => {
    expect(TYPE_SURFACE_IS_IDENTICAL).toBe(true);
  });
});
