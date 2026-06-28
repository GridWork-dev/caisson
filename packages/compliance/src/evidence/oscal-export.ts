// src/evidence/oscal-export.ts — OSCAL export adapter (ADR-0058, T15; ADR-0047 un-wired-seam ethos).
//
// The compliance edition's canonical output is the deterministic, signed Caisson evidence pack (T13).
// SOME buyers feed a GRC platform (FedRAMP, OpenSCAP, drawio-grade automation) that speaks NIST OSCAL
// instead. This adapter is the EXPORT SEAM: it maps an already-generated, already-validated
// `EvidencePackManifest` (the T13 pack shape) into OSCAL v1.1.3 document bodies —
//   - Security Assessment Results (SAR, root `assessment-results`): one finding per control, one
//     observation per evidence item; a control's derived readiness drives the finding's objective
//     status (`ready` → `satisfied`, `gap` → `not-satisfied`);
//   - Plan of Action & Milestones (POA&M, root `plan-of-action-and-milestones`): one `poam-item` per
//     GAP control, each referencing the flagged evidence as observations.
//
// It is a PLAIN, PURE, SEAM-TESTED FUNCTION — NO TRANSPORT. There is no live POST, no file write, no
// network. The live wire-up (push to a GRC system / OSCAL schema-conformance validation / a real
// `import-ap` + `import-ssp` resolution) is a `// P7:` seam below; v1 ships the deterministic mapping
// only (SPEC: "No OSCAL-native v1 artifact (export = un-wired seam)").
//
// Two invariants carry over from the pack's honesty floor (ADR-0058 / TM-K):
//   1. FLAG-NEVER-GUESS. The input is the canonical manifest, which by construction has NO unresolved
//      evidence (those hard-block generation upstream). Every item is `pass` | `flagged`; a `gap`
//      control's not-satisfied status records the flagged reason — nothing is inferred or fabricated.
//   2. READINESS LANGUAGE ONLY. The adapter authors neutral framing ("evidence assessment",
//      "remediation required"); it never claims "compliant"/"certified". (OSCAL's own required
//      `satisfied`/`not-satisfied` objective-status enum is format vocabulary, not a conformance claim.)
//
// DETERMINISM (mirrors T13 / T14): the wall-clock instant is INJECTED (`now`, clock at the edge) and
// UUID minting is a SEAM (`newId`, default `crypto.randomUUID`). With both injected, the output is
// byte-stable and canonicalizable — so an export can be golden-fixtured or content-hashed downstream.
import { randomUUID } from "node:crypto";
import { ValidationError } from "@caisson/kernel";
import type { EvidencePackManifest, ManifestControl } from "./pack-format.ts";

/** The OSCAL model version these bodies are authored against (NIST OSCAL JSON, csrc.nist.gov/ns/oscal). */
export const OSCAL_VERSION = "1.1.3" as const;

/** The Caisson property/extension namespace stamped on OSCAL `prop`/`link` extensions. */
const CAISSON_OSCAL_NS = "https://caisson.sh/ns/oscal";

const SHA256_HEX = /^[0-9a-f]{64}$/;

// --- the OSCAL subset these bodies emit (typed, JSON-safe so it survives `canonicalize`) ----------
// Only the properties this adapter populates are modeled. OSCAL allows far more (props/links/roles/
// parties/risks); a richer mapping extends these interfaces behind the same seam.

interface OscalProp {
  readonly name: string;
  readonly value: string;
  readonly ns?: string;
  readonly class?: string;
}

interface OscalLink {
  readonly href: string;
  readonly rel?: string;
  readonly text?: string;
}

interface OscalMetadata {
  readonly title: string;
  readonly "last-modified": string;
  readonly version: string;
  readonly "oscal-version": string;
  readonly props?: readonly OscalProp[];
  readonly links?: readonly OscalLink[];
}

/** One observation — a recorded examination of an evidence item gathered at assessment time. */
interface OscalObservation {
  readonly uuid: string;
  readonly title: string;
  readonly description: string;
  readonly methods: readonly string[];
  readonly collected: string;
}

interface OscalRelatedObservation {
  readonly "observation-uuid": string;
}

/** A finding's objective status — `satisfied`/`not-satisfied` is OSCAL's required enum (format vocab). */
interface OscalFindingStatus {
  readonly state: "satisfied" | "not-satisfied";
  readonly reason?: string;
}

interface OscalFindingTarget {
  readonly type: "objective-id";
  readonly "target-id": string;
  readonly status: OscalFindingStatus;
}

interface OscalFinding {
  readonly uuid: string;
  readonly title: string;
  readonly description: string;
  readonly target: OscalFindingTarget;
  readonly "related-observations": readonly OscalRelatedObservation[];
}

interface OscalControlSelection {
  readonly "include-all": Record<string, never>;
}

interface OscalReviewedControls {
  readonly "control-selections": readonly OscalControlSelection[];
}

interface OscalResult {
  readonly uuid: string;
  readonly title: string;
  readonly description: string;
  readonly start: string;
  readonly "reviewed-controls": OscalReviewedControls;
  readonly props: readonly OscalProp[];
  readonly observations: readonly OscalObservation[];
  readonly findings: readonly OscalFinding[];
}

interface OscalImportAp {
  readonly href: string;
}

/** The SAR body (root `assessment-results`). */
export interface OscalAssessmentResults {
  readonly uuid: string;
  readonly metadata: OscalMetadata;
  readonly "import-ap": OscalImportAp;
  readonly results: readonly OscalResult[];
}

/** A SAR document — the OSCAL file root wraps the body under its model key. */
export interface OscalAssessmentResultsDocument {
  readonly "assessment-results": OscalAssessmentResults;
}

interface OscalSystemId {
  readonly "identifier-type": string;
  readonly id: string;
}

interface OscalPoamItem {
  readonly uuid: string;
  readonly title: string;
  readonly description: string;
  readonly "related-observations": readonly OscalRelatedObservation[];
}

/** The POA&M body (root `plan-of-action-and-milestones`). */
export interface OscalPlanOfActionAndMilestones {
  readonly uuid: string;
  readonly metadata: OscalMetadata;
  readonly "system-id": OscalSystemId;
  readonly props: readonly OscalProp[];
  readonly observations?: readonly OscalObservation[];
  readonly "poam-items": readonly OscalPoamItem[];
}

/** A POA&M document — the OSCAL file root wraps the body under its model key. */
export interface OscalPlanOfActionAndMilestonesDocument {
  readonly "plan-of-action-and-milestones": OscalPlanOfActionAndMilestones;
}

/** Both OSCAL documents derived from one evidence pack. */
export interface OscalExportBundle {
  readonly assessmentResults: OscalAssessmentResultsDocument;
  readonly planOfActionAndMilestones: OscalPlanOfActionAndMilestonesDocument;
}

/**
 * Adapter options. `now` is the clock at the edge (the OSCAL `last-modified`/`collected`/`start`
 * instant); `newId` is the UUID seam (default `crypto.randomUUID`) — inject a deterministic sequence
 * to make the export byte-stable for golden-fixturing or content-hashing.
 */
export interface OscalExportOptions {
  /** Injected wall-clock instant. Must be a valid `Date`; stamped on metadata + observations. */
  readonly now: Date;
  /** OSCAL UUID source. Defaults to `crypto.randomUUID`; a fixed sequence makes the output deterministic. */
  readonly newId?: () => string;
  /** `import-ap` href for the SAR — the assessment-plan it realizes. Un-wired default is a local fragment. */
  readonly assessmentPlanHref?: string;
  /** Optional provenance: the T13 evidence-pack archive SHA-256 (recorded as a `prop`). Must be 64-hex. */
  readonly packSha256?: string;
}

/** A bounded examination method. The substrate facts are EXAMINEd (read), never TESTed live here. */
const EXAMINE: readonly string[] = ["EXAMINE"];

/** Build the metadata block shared by both documents — title + injected clock + chain-anchor binding. */
function buildMetadata(
  title: string,
  manifest: EvidencePackManifest,
  lastModified: string,
  options: OscalExportOptions,
): OscalMetadata {
  const props: OscalProp[] = [
    {
      name: "caisson-readiness-posture",
      ns: CAISSON_OSCAL_NS,
      value: manifest.summary.posture,
    },
  ];
  if (options.packSha256 !== undefined) {
    if (!SHA256_HEX.test(options.packSha256)) {
      throw new ValidationError(
        "oscal export `packSha256` must be a lowercase 64-char hex digest",
      );
    }
    props.push({
      name: "caisson-evidence-pack-sha256",
      ns: CAISSON_OSCAL_NS,
      value: options.packSha256,
    });
  }
  return {
    title,
    "last-modified": lastModified,
    version: manifest.framework.version,
    "oscal-version": OSCAL_VERSION,
    props,
    // Bind the OSCAL doc to the WORM audit-chain tip it was derived from (same anchor T14 signs).
    links: [
      {
        href: `urn:caisson:audit-chain:${manifest.chainAnchor.tipHash}`,
        rel: "caisson-audit-chain-anchor",
        text: `Audit-chain anchor (length ${String(manifest.chainAnchor.length)})`,
      },
    ],
  };
}

/** The flagged-evidence reasons for a gap control, joined for a finding/poam-item rationale (TM-K). */
function gapReason(control: ManifestControl): string {
  return control.evidence
    .filter((e) => e.status === "flagged" && e.reason !== undefined)
    .map((e) => `${e.collectorId}: ${e.reason ?? ""}`)
    .join("; ");
}

function resolveNow(options: OscalExportOptions): string {
  if (Number.isNaN(options.now.getTime())) {
    throw new ValidationError("oscal export requires a valid `now` instant");
  }
  return options.now.toISOString();
}

/**
 * Map an evidence-pack manifest to an OSCAL Security Assessment Results (SAR) document.
 *
 * One `finding` per control (objective status DERIVED from readiness: `ready`→`satisfied`,
 * `gap`→`not-satisfied`, gap reason recorded), one `observation` per evidence item, the finding
 * linking its control's observations. Deterministic given injected `now` + `newId`. Fails closed on a
 * bad clock / malformed provenance.
 */
export function toOscalAssessmentResults(
  manifest: EvidencePackManifest,
  options: OscalExportOptions,
): OscalAssessmentResultsDocument {
  const lastModified = resolveNow(options);
  const newId = options.newId ?? randomUUID;

  const observations: OscalObservation[] = [];
  const findings: OscalFinding[] = [];
  for (const control of manifest.controls) {
    const related: OscalRelatedObservation[] = [];
    for (const item of control.evidence) {
      const uuid = newId();
      observations.push({
        uuid,
        title: `${control.controlId} / ${item.collectorId}`,
        description: item.summary,
        methods: EXAMINE,
        collected: lastModified,
      });
      related.push({ "observation-uuid": uuid });
    }
    const target: OscalFindingTarget =
      control.readiness === "ready"
        ? {
            type: "objective-id",
            "target-id": control.controlId,
            status: { state: "satisfied" },
          }
        : {
            type: "objective-id",
            "target-id": control.controlId,
            status: { state: "not-satisfied", reason: gapReason(control) },
          };
    findings.push({
      uuid: newId(),
      title: `${control.controlId} — ${control.title}`,
      description: control.statement,
      target,
      "related-observations": related,
    });
  }

  const result: OscalResult = {
    uuid: newId(),
    title: `Control evidence assessment — ${manifest.framework.title}`,
    description: manifest.summary.posture,
    start: lastModified,
    "reviewed-controls": { "control-selections": [{ "include-all": {} }] },
    props: [
      {
        name: "caisson-readiness-posture",
        ns: CAISSON_OSCAL_NS,
        value: manifest.summary.posture,
      },
    ],
    observations,
    findings,
  };

  return {
    "assessment-results": {
      uuid: newId(),
      metadata: buildMetadata(
        `Security Assessment Results — ${manifest.framework.title}`,
        manifest,
        lastModified,
        options,
      ),
      "import-ap": {
        href: options.assessmentPlanHref ?? "#caisson-assessment-plan",
      },
      results: [result],
    },
  };
}

/**
 * Map an evidence-pack manifest to an OSCAL Plan of Action & Milestones (POA&M) document.
 *
 * One `poam-item` per GAP control (a control with any flagged evidence), each referencing the flagged
 * items as `observations` and recording the gap reason — a clean pack yields zero items (no fabricated
 * remediation). The tenant is identified via `system-id` (no SSP exists in v1; `import-ssp` is the
 * `// P7:` wire-up). Deterministic given injected `now` + `newId`.
 */
export function toOscalPlanOfActionAndMilestones(
  manifest: EvidencePackManifest,
  options: OscalExportOptions,
): OscalPlanOfActionAndMilestonesDocument {
  const lastModified = resolveNow(options);
  const newId = options.newId ?? randomUUID;

  const observations: OscalObservation[] = [];
  const poamItems: OscalPoamItem[] = [];
  for (const control of manifest.controls) {
    if (control.readiness !== "gap") continue;
    const related: OscalRelatedObservation[] = [];
    for (const item of control.evidence) {
      if (item.status !== "flagged") continue;
      const uuid = newId();
      observations.push({
        uuid,
        title: `${control.controlId} / ${item.collectorId}`,
        description: item.reason ?? item.summary,
        methods: EXAMINE,
        collected: lastModified,
      });
      related.push({ "observation-uuid": uuid });
    }
    poamItems.push({
      uuid: newId(),
      title: `${control.controlId} — ${control.title}`,
      description: `Remediation required for ${control.controlId}: ${gapReason(control)}`,
      "related-observations": related,
    });
  }

  const body: OscalPlanOfActionAndMilestones = {
    uuid: newId(),
    metadata: buildMetadata(
      `Plan of Action and Milestones — ${manifest.framework.title}`,
      manifest,
      lastModified,
      options,
    ),
    "system-id": {
      "identifier-type": "https://caisson.sh/ns/tenant",
      id: manifest.tenantId,
    },
    props: [
      {
        name: "caisson-readiness-posture",
        ns: CAISSON_OSCAL_NS,
        value: manifest.summary.posture,
      },
    ],
    // `observations` is OSCAL-optional; omit it (not `[]`) for a clean pack to keep the body minimal.
    ...(observations.length > 0 ? { observations } : {}),
    "poam-items": poamItems,
  };

  return { "plan-of-action-and-milestones": body };
}

/** Map an evidence-pack manifest to BOTH OSCAL documents (SAR + POA&M) in one deterministic call. */
export function toOscalBundle(
  manifest: EvidencePackManifest,
  options: OscalExportOptions,
): OscalExportBundle {
  return {
    assessmentResults: toOscalAssessmentResults(manifest, options),
    planOfActionAndMilestones: toOscalPlanOfActionAndMilestones(
      manifest,
      options,
    ),
  };
}

// --- the un-wired transport seam (P7) ----------------------------------------------------------

/**
 * The OSCAL delivery port. A relying party may want the bundle PUSHED to a GRC platform's OSCAL
 * ingest endpoint rather than handed back as JSON.
 *
 * UN-WIRED LIVE SEAM (ADR-0047 ethos / SPEC "export = un-wired seam"): there is NO live
 * implementation in v1, and NO call site reaches a network. A future implementation of this port
 * delivers `bundle` to its sink.
 *
 * // P7: wire a live OSCAL transport here — POST each document to the GRC endpoint over
 * //   `fetchWithTimeout(url, init, ms)` (NEVER the native `AbortSignal.timeout` helper on Bun),
 * //   Bearer-gated, validating each body against the official OSCAL JSON schema before send, and
 * //   resolving a real `import-ap`/`import-ssp` href. None of that runs on the CI path.
 */
export interface OscalExportTransport {
  deliver(bundle: OscalExportBundle): Promise<void>;
}
