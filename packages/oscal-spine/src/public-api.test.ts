import { describe, expect, test } from "bun:test";
import * as oscalSpine from "./index.ts";

/**
 * Runtime names exported by the two parent roots before the ADR-0384 carve (`af776c1c`). This
 * independent snapshot prevents an omission from disappearing from both a parent and the new
 * package while their identity-only re-export tests remain green.
 */
const PRE_CARVE_RUNTIME_EXPORTS = [
  "CAISSON_OSCAL_NS",
  "ISO27001_SOA_ARCHIVE_ENTRY",
  "ISO27001_SOA_SOURCE_URN",
  "NIST_CATALOG_COMMIT_SHA",
  "NIST_CATALOG_OSCAL_VERSION",
  "NIST_CATALOG_PIN",
  "NIST_CATALOG_REPO",
  "NIST_CATALOG_SHA256",
  "NIST_CATALOG_SOURCE_URL",
  "NIST_CATALOG_UPSTREAM_PATH",
  "NIST_CATALOG_VENDORED_FILENAME",
  "NIST_CATALOG_VERSION",
  "OSCAL_VERSION",
  "OscalDeliveryConfigSchema",
  "ProofKind",
  "ProofPointer",
  "RegimeCrosswalk",
  "RegimeCrosswalkRow",
  "RegimeCrosswalkSeedProvenance",
  "RegimeId",
  "buildConvertArgs",
  "buildIso27001SoaArchiveEntry",
  "buildValidateArgs",
  "caissonAssessmentPlanUrl",
  "convertAndValidate",
  "convertJsonToXml",
  "createOscalHttpTransport",
  "defineRegimeCrosswalk",
  "exportRegimeCrosswalk",
  "extractControlIds",
  "nist80053Crosswalk",
  "oscalCliAvailable",
  "toOscalAssessmentPlan",
  "toOscalAssessmentResults",
  "toOscalBundle",
  "toOscalCatalog",
  "toOscalIso27001Soa",
  "toOscalPlanOfActionAndMilestones",
] as const;

describe("@caisson-sh/oscal-spine pre-carve public API", () => {
  test("retains every historical runtime export", () => {
    const available = new Set(Object.keys(oscalSpine));
    expect(
      PRE_CARVE_RUNTIME_EXPORTS.filter((name) => !available.has(name)),
    ).toEqual([]);
  });
});
