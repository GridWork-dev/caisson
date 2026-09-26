// src/evidence/oscal-assessment-plan.ts — OSCAL v1.2.2 Assessment-Plan (AP) authoring (ADR-0231, ADR-0179 §B).
//
// ADR-0179 §B promised a per-framework OSCAL Assessment-Plan the SAR's `import-ap`/back-matter rlink
// resolves to; it was never authored, so the SAR shipped a dead `caisson.sh/oscal/assessment-plan/...`
// link (ADR-0208 §4 parked it won't-fix). ADR-0231 reverses that: this module authors the real AP as a
// minimal-but-valid OSCAL `assessment-plan` body, bundled beside the SAR with a relative rlink + a
// SHA-256 `hashes[]` integrity binding (see `oscal-bundle.ts`).
//
// The plan is per-FRAMEWORK and tenant-agnostic (a template of what a Caisson assessment reviews) — it
// takes only the `{id,title,version}` framework triple, no manifest. There is no separate SSP, so
// `import-ssp` resolves to a stable Caisson URN placeholder (an honest identifier, never a fake HTTP URL
// that 404s); schema-only conformance (ADR-0180 `--disable-constraint-validation`) does not resolve it.
//
// DETERMINISM (mirrors the SAR/POA&M mapper): `now` + `newId` are injected, so the body is byte-stable
// and its canonical SHA-256 is stable — the invariant the bundle's `hashes[]` and the goldens depend on.
import { ValidationError } from "@caisson-sh/kernel";
import {
  CAISSON_OSCAL_NS,
  OSCAL_VERSION,
  type OscalEvidencePackFramework,
} from "../contracts.ts";
import type {
  OscalExportOptions,
  OscalMetadata,
  OscalReviewedControls,
} from "./oscal-export.ts";

/** `import-ssp` on an assessment-plan — the system-security-plan the assessment is planned against. */
interface OscalImportSsp {
  readonly href: string;
}

/** The AP body (root `assessment-plan`). Minimal OSCAL v1.2.2: uuid + metadata + import-ssp + reviewed-controls. */
export interface OscalAssessmentPlan {
  readonly uuid: string;
  readonly metadata: OscalMetadata;
  readonly "import-ssp": OscalImportSsp;
  readonly "reviewed-controls": OscalReviewedControls;
}

/** An AP document — the OSCAL file root wraps the body under its model key. */
export interface OscalAssessmentPlanDocument {
  readonly "assessment-plan": OscalAssessmentPlan;
}

/**
 * The `import-ssp` href for a template AP. There is no per-tenant SSP in v1 (the tenant system is
 * resolved at assessment time), so this is a stable Caisson URN — an identifier, never a resolvable HTTP
 * URL. Constraint validation (which would resolve it) is off in the conformance gate (ADR-0180).
 */
const AP_IMPORT_SSP_HREF = "urn:caisson:oscal:assessment-plan:no-ssp";

/**
 * Author a minimal-but-valid OSCAL v1.2.2 `assessment-plan` document for a framework — the never-delivered
 * ADR-0179 §B content. Deterministic given injected `now` + `newId` (default `crypto.randomUUID`), so the
 * bundle's `hashes[]` binding over its canonical bytes is stable. Fails closed on a bad clock.
 */
export function toOscalAssessmentPlan(
  framework: OscalEvidencePackFramework,
  options: OscalExportOptions,
): OscalAssessmentPlanDocument {
  if (Number.isNaN(options.now.getTime())) {
    throw new ValidationError(
      "oscal assessment-plan requires a valid `now` instant",
    );
  }
  const newId = options.newId ?? (() => crypto.randomUUID());
  const metadata: OscalMetadata = {
    title: `Assessment Plan — ${framework.title}`,
    "last-modified": options.now.toISOString(),
    version: framework.version,
    "oscal-version": OSCAL_VERSION,
    props: [
      {
        name: "caisson-framework-id",
        ns: CAISSON_OSCAL_NS,
        value: framework.id,
      },
    ],
  };
  return {
    "assessment-plan": {
      uuid: newId(),
      metadata,
      "import-ssp": { href: AP_IMPORT_SSP_HREF },
      // Reviews every control in the framework's Caisson pack (mirrors the SAR's include-all selection).
      "reviewed-controls": { "control-selections": [{ "include-all": {} }] },
    },
  };
}
