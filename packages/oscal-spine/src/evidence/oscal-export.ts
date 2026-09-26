// src/evidence/oscal-export.ts — OSCAL export adapter (ADR-0058; ADR-0047 un-wired-seam ethos).
//
// The compliance edition's canonical output is the deterministic, signed Caisson evidence pack.
// SOME buyers feed a GRC platform (FedRAMP, OpenSCAP, drawio-grade automation) that speaks NIST OSCAL
// instead. This adapter is the EXPORT SEAM: it maps an already-generated, already-validated
// `EvidencePackManifest` into OSCAL v1.2.2 document bodies —
//   - Security Assessment Results (SAR, root `assessment-results`): one finding per control, one
//     observation per evidence item; a control's derived readiness drives the finding's objective
//     status (`ready` → `satisfied`, `gap` → `not-satisfied`);
//   - Plan of Action & Milestones (POA&M, root `plan-of-action-and-milestones`): one `poam-item` per
//     GAP control, each referencing the flagged evidence as observations.
//
// It is a PLAIN, PURE, SEAM-TESTED FUNCTION — NO TRANSPORT. There is no live POST, no file write, no
// network. The live wire-up (push to a GRC system / OSCAL schema-conformance validation / a real
// `import-ap` + `import-ssp` resolution) is a documented seam below; v1 ships the deterministic
// mapping only (SPEC: "No OSCAL-native v1 artifact (export = un-wired seam)").
//
// Two invariants carry over from the pack's honesty floor (ADR-0058):
//   1. FLAG-NEVER-GUESS. The input is the canonical manifest, which by construction has NO unresolved
//      evidence (those hard-block generation upstream). Every item is `pass` | `flagged`; a `gap`
//      control's not-satisfied status records the flagged reason — nothing is inferred or fabricated.
//   2. READINESS LANGUAGE ONLY. The adapter authors neutral framing ("evidence assessment",
//      "remediation required"); it never claims "compliant"/"certified". (OSCAL's own required
//      `satisfied`/`not-satisfied` objective-status enum is format vocabulary, not a conformance claim.)
//
// DETERMINISM (mirrors the generator + signer): the wall-clock instant is INJECTED (`now`, clock at the edge) and
// UUID minting is a SEAM (`newId`, default `crypto.randomUUID`). With both injected, the output is
// byte-stable and canonicalizable — so an export can be golden-fixtured or content-hashed downstream.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  assertSafePublicUrl,
  assertSafePublicUrlResolved,
  fetchWithTimeout,
  InternalError,
  strictObject,
  ValidationError,
} from "@caisson-sh/kernel/node";
import type {
  OscalEvidencePackManifest,
  OscalManifestControl,
} from "../contracts.ts";
import {
  CAISSON_OSCAL_NS,
  OSCAL_VERSION,
  parseOscalEvidencePackManifest,
} from "../contracts.ts";

/**
 * The legacy Caisson-hosted per-framework Assessment-Plan (AP) artifact URL (ADR-0179). It was the
 * default back-matter `rlink` target — but the AP it pointed at was never authored, so the link
 * dangled (ADR-0208 §4 parked it won't-fix).
 *
 * **Superseded-as-default (ADR-0231).** The AP is now authored (`oscal-assessment-plan.ts`) and shipped
 * in a signed evidence bundle (`oscal-bundle.ts`); the emitted back-matter `rlink` is a RELATIVE
 * in-bundle path with a SHA-256 `hashes[]` integrity binding — supply `OscalExportOptions.assessmentPlan`.
 * This URL survives ONLY as the bare-call fallback for a caller that supplies neither `assessmentPlan`
 * nor `assessmentPlanHref`; it is still not served, and no real export path emits it.
 */
export function caissonAssessmentPlanUrl(frameworkId: string): string {
  return `https://caisson.sh/oscal/assessment-plan/${frameworkId}.json`;
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

// --- the OSCAL subset these bodies emit (typed, JSON-safe so it survives `canonicalize`) ----------
// Only the properties this adapter populates are modeled. OSCAL allows far more (props/links/roles/
// parties/risks); a richer mapping extends these interfaces behind the same seam.

export interface OscalProp {
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

export interface OscalMetadata {
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
  // OSCAL `status/@reason` is a constrained TOKEN (allowed values: pass/fail/other) — free prose there
  // fails NIST XSD (cvc-datatype-valid). The gap rationale is markup, so it lives in `remarks`.
  readonly remarks?: string;
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

export interface OscalControlSelection {
  readonly "include-all": Record<string, never>;
}

export interface OscalReviewedControls {
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

/** An OSCAL hash on an rlink — the FedRAMP-recommended integrity binding to the referenced bytes. */
export interface OscalHash {
  readonly algorithm: string;
  readonly value: string;
}

/** A remote link on a back-matter resource — the resolvable location of the referenced artifact. */
export interface OscalRlink {
  readonly href: string;
  readonly "media-type"?: string;
  /** SHA-256 integrity binding to the referenced bytes (ADR-0231 bundle path). */
  readonly hashes?: readonly OscalHash[];
}

/** One back-matter resource — a referenced artifact (here, the canonical per-framework AP; ADR-0179). */
interface OscalBackMatterResource {
  readonly uuid: string;
  readonly title: string;
  readonly props?: readonly OscalProp[];
  readonly rlinks: readonly OscalRlink[];
}

interface OscalBackMatter {
  readonly resources: readonly OscalBackMatterResource[];
}

/** The SAR body (root `assessment-results`). */
export interface OscalAssessmentResults {
  readonly uuid: string;
  readonly metadata: OscalMetadata;
  readonly "import-ap": OscalImportAp;
  readonly results: readonly OscalResult[];
  readonly "back-matter"?: OscalBackMatter;
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

/** The POA&M body (root `plan-of-action-and-milestones`). No root-level `props` — OSCAL doesn't allow
 * them here (the posture prop lives in `metadata.props`); `poam-items` is required min-1 (NIST XSD). */
export interface OscalPlanOfActionAndMilestones {
  readonly uuid: string;
  readonly metadata: OscalMetadata;
  readonly "system-id": OscalSystemId;
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
  /**
   * `import-ap` href for the SAR. When omitted (the default), `import-ap` resolves to a shipped
   * back-matter resource that rlinks the canonical Caisson per-framework AP (ADR-0179). Supply this to
   * point at a buyer-hosted assessment plan instead — then no Caisson AP back-matter resource is emitted.
   */
  readonly assessmentPlanHref?: string;
  /**
   * The bundled Assessment-Plan reference (ADR-0231). When supplied (and no `assessmentPlanHref`
   * override), the shipped back-matter AP resource rlinks this RELATIVE in-bundle path
   * (e.g. `./assessment-plan/soc2-tsc.json`) with an optional SHA-256 `hashes[]` integrity binding —
   * instead of the legacy `caissonAssessmentPlanUrl`. Set by the bundle assembler (`oscal-bundle.ts`).
   */
  readonly assessmentPlan?: {
    readonly rlinkHref: string;
    /** SHA-256 of the canonicalized bundled AP bytes (lowercase 64-char hex). Bound as `rlink.hashes[]`. */
    readonly sha256?: string;
  };
  /** Optional provenance: the evidence-pack archive SHA-256 (recorded as a `prop`). Must be 64-hex. */
  readonly packSha256?: string;
}

/** A bounded examination method. The substrate facts are EXAMINEd (read), never TESTed live here. */
const EXAMINE: readonly string[] = ["EXAMINE"];

/** Build the metadata block shared by both documents — title + injected clock + chain-anchor binding. */
function buildMetadata(
  title: string,
  manifest: OscalEvidencePackManifest,
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
    // Bind the OSCAL doc to the WORM audit-chain tip it was derived from (same anchor the signer signs).
    links: [
      {
        href: `urn:caisson:audit-chain:${manifest.chainAnchor.tipHash}`,
        rel: "caisson-audit-chain-anchor",
        text: `Audit-chain anchor (length ${String(manifest.chainAnchor.length)})`,
      },
    ],
  };
}

/** The flagged-evidence reasons for a gap control, joined for a finding/poam-item rationale. */
function gapReason(control: OscalManifestControl): string {
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
 * The AP back-matter `rlink` for the SAR. ADR-0231 bundle path: when `assessmentPlan` is supplied, emit
 * the caller's RELATIVE in-bundle href + a SHA-256 `hashes[]` binding. Otherwise fall back to the legacy
 * (un-served, superseded-as-default) `caissonAssessmentPlanUrl`. Fails closed on a malformed digest.
 */
function buildApRlink(
  frameworkId: string,
  options: OscalExportOptions,
): OscalRlink {
  const plan = options.assessmentPlan;
  if (plan === undefined) {
    return {
      href: caissonAssessmentPlanUrl(frameworkId),
      "media-type": "application/oscal-assessment-plan+json",
    };
  }
  const href = plan.rlinkHref;
  const withoutLeadingDot = href.startsWith("./") ? href.slice(2) : href;
  const pathSegments = withoutLeadingDot.split("/");
  const invalidHref =
    href.trim().length === 0 ||
    href !== href.trim() ||
    href.startsWith("/") ||
    href.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(href) ||
    href.includes("\\") ||
    href.includes("?") ||
    href.includes("#") ||
    href.includes("\0") ||
    href.includes("%") ||
    pathSegments.some(
      (segment) => segment.length === 0 || segment === "." || segment === "..",
    );
  if (invalidHref) {
    throw new ValidationError(
      "oscal export `assessmentPlan.rlinkHref` must be a contained relative POSIX bundle path",
    );
  }
  if (plan.sha256 !== undefined && !SHA256_HEX.test(plan.sha256)) {
    throw new ValidationError(
      "oscal export `assessmentPlan.sha256` must be a lowercase 64-char hex digest",
    );
  }
  return {
    href,
    "media-type": "application/oscal-assessment-plan+json",
    ...(plan.sha256 !== undefined
      ? { hashes: [{ algorithm: "SHA-256", value: plan.sha256 }] }
      : {}),
  };
}

/**
 * Map an evidence-pack manifest to an OSCAL Security Assessment Results (SAR) document.
 *
 * One `finding` per control (objective status DERIVED from readiness: `ready`→`satisfied`,
 * `gap`→`not-satisfied`, gap reason recorded), one `observation` per evidence item, the finding
 * linking its control's observations. Deterministic given injected `now` + `newId`. Fails closed on a
 * bad clock / malformed provenance.
 */
function buildOscalAssessmentResults(
  manifest: OscalEvidencePackManifest,
  options: OscalExportOptions,
): OscalAssessmentResultsDocument {
  const lastModified = resolveNow(options);
  const newId = options.newId ?? randomUUID;

  // ADR-0179/0231: resolve `import-ap` to a shipped per-framework AP fragment — a back-matter resource
  // `#uuid` (resolvable in-document) whose rlink points at the AP. The ADR-0231 bundle path supplies a
  // RELATIVE in-bundle href + SHA-256 `hashes[]` (`assessmentPlan`); a buyer-supplied `assessmentPlanHref`
  // overrides + ships no AP resource; a bare call falls back to the legacy `caissonAssessmentPlanUrl`.
  let importApHref: string;
  let backMatter: OscalBackMatter | undefined;
  if (options.assessmentPlanHref !== undefined) {
    importApHref = options.assessmentPlanHref;
  } else {
    const apResourceUuid = newId();
    importApHref = `#${apResourceUuid}`;
    backMatter = {
      resources: [
        {
          uuid: apResourceUuid,
          title: `Caisson canonical assessment plan — ${manifest.framework.title}`,
          props: [
            { name: "type", ns: CAISSON_OSCAL_NS, value: "assessment-plan" },
          ],
          rlinks: [buildApRlink(manifest.framework.id, options)],
        },
      ],
    };
  }

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
            status: { state: "not-satisfied", remarks: gapReason(control) },
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
      // ADR-0333/ADR-0347 Fork F: the cross-framework rollup rides the existing SAR as report
      // content, never a new OSCAL catalog-model artifact. `prop/@value` is a free string (like the
      // posture prop above), so JSON-serializing the whole rollup here is schema-safe -- no
      // NIST-constrained token field involved (the R1 risk this deliberately avoids).
      // ponytail: reuses the existing OscalProp machinery; one prop for the whole rollup rather than
      // one per cell keeps the SAR from growing an unbounded per-cell prop list.
      {
        name: "caisson-crosswalk-rollup",
        ns: CAISSON_OSCAL_NS,
        value: JSON.stringify(manifest.crosswalkRollup),
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
      "import-ap": { href: importApHref },
      results: [result],
      ...(backMatter !== undefined ? { "back-matter": backMatter } : {}),
    },
  };
}

export function toOscalAssessmentResults(
  manifest: OscalEvidencePackManifest,
  options: OscalExportOptions,
): OscalAssessmentResultsDocument {
  return buildOscalAssessmentResults(
    parseOscalEvidencePackManifest(manifest),
    options,
  );
}

/**
 * Map an evidence-pack manifest to an OSCAL Plan of Action & Milestones (POA&M) document.
 *
 * One `poam-item` per GAP control (a control with any flagged evidence), each referencing the flagged
 * items as `observations` and recording the gap reason — a clean pack yields zero items (no fabricated
 * remediation). The tenant is identified via `system-id` (no SSP exists in v1; `import-ssp` is part
 * of the un-wired transport seam below). Deterministic given injected `now` + `newId`.
 */
function buildOscalPlanOfActionAndMilestones(
  manifest: OscalEvidencePackManifest,
  options: OscalExportOptions,
): OscalPlanOfActionAndMilestonesDocument {
  const lastModified = resolveNow(options);
  const newId = options.newId ?? randomUUID;

  // Observations mirror every examined evidence item (like the SAR), so the POA&M is never empty: NIST
  // XSD requires plan-of-action-and-milestones to carry >=1 of {observation, risk, finding, poam-item},
  // and a clean pack has zero poam-items. Observations are real (what we examined) — no fabrication.
  // poam-items are still GAP-only; each references its flagged observations.
  const observations: OscalObservation[] = [];
  const poamItems: OscalPoamItem[] = [];
  for (const control of manifest.controls) {
    const related: OscalRelatedObservation[] = [];
    for (const item of control.evidence) {
      const uuid = newId();
      observations.push({
        uuid,
        title: `${control.controlId} / ${item.collectorId}`,
        description: item.reason ?? item.summary,
        methods: EXAMINE,
        collected: lastModified,
      });
      if (item.status === "flagged") related.push({ "observation-uuid": uuid });
    }
    if (control.readiness !== "gap") continue;
    poamItems.push({
      uuid: newId(),
      title: `${control.controlId} — ${control.title}`,
      description: `Remediation required for ${control.controlId}: ${gapReason(control)}`,
      "related-observations": related,
    });
  }

  // NIST XSD requires poam-items min-1. A clean pack (zero gaps) has no remediation to fabricate, so
  // emit ONE truthful informational item stating there are no open items — honest, not a made-up gap.
  if (poamItems.length === 0) {
    poamItems.push({
      uuid: newId(),
      title: "No open remediation items",
      description: `All controls are evidence-ready; no gaps recorded. ${manifest.summary.posture}`,
      "related-observations": [],
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
    // Observations mirror examined evidence (posture prop is in metadata; POA&M root takes no props).
    ...(observations.length > 0 ? { observations } : {}),
    "poam-items": poamItems,
  };

  return { "plan-of-action-and-milestones": body };
}

export function toOscalPlanOfActionAndMilestones(
  manifest: OscalEvidencePackManifest,
  options: OscalExportOptions,
): OscalPlanOfActionAndMilestonesDocument {
  return buildOscalPlanOfActionAndMilestones(
    parseOscalEvidencePackManifest(manifest),
    options,
  );
}

/** Map an evidence-pack manifest to BOTH OSCAL documents (SAR + POA&M) in one deterministic call. */
export function toOscalBundle(
  manifest: OscalEvidencePackManifest,
  options: OscalExportOptions,
): OscalExportBundle {
  const validated = parseOscalEvidencePackManifest(manifest);
  return {
    assessmentResults: buildOscalAssessmentResults(validated, options),
    planOfActionAndMilestones: buildOscalPlanOfActionAndMilestones(
      validated,
      options,
    ),
  };
}

// --- the transport seam (live as of the OSCAL-push wave) ------------------------------------------

/**
 * The OSCAL delivery port. A relying party may want the bundle PUSHED to a GRC platform's OSCAL
 * ingest endpoint rather than handed back as JSON.
 *
 * `createOscalHttpTransport` below is the live implementation: a neutral HTTPS-POST adapter (no
 * vendor-specific GRC protocol — the backlog row that opened this seam names no concrete GRC
 * platform, so this ships the OSCAL-ecosystem-conventional shape and stops there; a vendor-specific
 * dialect is a follow-on fork once a real buyer names their ingest endpoint).
 */
export interface OscalExportTransport {
  deliver(bundle: OscalExportBundle): Promise<void>;
}

/**
 * Live delivery config. `destinationUrl` is validated https-only + non-private/non-loopback at
 * construction (`assertSafePublicUrl` — the same kernel SSRF-literal guard `@caisson-sh/alerting`'s
 * webhook/Slack/Telegram channels use for buyer-supplied destinations) AND re-checked (DNS-resolved)
 * at the fetch seam inside `postOscalDocument`, so `deliver` stays safe even for a config object
 * built directly rather than through this schema — the same "guard at both seams" idiom alerting's
 * webhook/Slack/Telegram/Discord channels use.
 */
export const OscalDeliveryConfigSchema = strictObject({
  destinationUrl: z.string().superRefine((value, ctx) => {
    try {
      assertSafePublicUrl(value);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : "invalid URL",
      });
    }
  }),
  /** Optional Bearer credential for the GRC endpoint. */
  bearerToken: z.string().min(1).optional(),
  /** Optional per-request timeout override (ms), threaded to `fetchWithTimeout`. */
  timeoutMs: z.number().int().positive().optional(),
});
export type OscalDeliveryConfig = z.infer<typeof OscalDeliveryConfigSchema>;

/** The fetch-seam SSRF re-check `postOscalDocument` runs before every POST. Defaults to the real
 * kernel guard; a caller (tests only — see oscal-export.test.ts) may inject a stub that accepts a
 * loopback destination without weakening the production default. */
export type AssertDestinationSafe = (url: string) => Promise<void>;

/** OSCAL-ecosystem-conventional media types — mirrors this file's own
 * `application/oscal-assessment-plan+json` naming (full-word, hyphen-separated). */
const OSCAL_MEDIA_TYPE = {
  assessmentResults: "application/oscal-assessment-results+json",
  poam: "application/oscal-poam+json",
} as const;

/** POST one OSCAL document to the configured destination. Re-runs the resolved SSRF guard
 * immediately before the fetch (the alerting idiom — a config object can be built without parsing
 * `OscalDeliveryConfigSchema`). Single attempt — no retry storm; a caller that wants retries owns
 * that policy. Fails closed — on a non-2xx OR on the fetch itself throwing (timeout/DNS/redirect) —
 * with a typed `InternalError` carrying only the document label + a coarse cause classification,
 * never the response body or a raw stack (a GRC ingest error can echo submitted tenant/control
 * content, and a raw stack can leak host/path detail). */
async function postOscalDocument(
  config: OscalDeliveryConfig,
  document: unknown,
  mediaType: string,
  label: string,
  assertDestinationSafe: AssertDestinationSafe,
): Promise<void> {
  await assertDestinationSafe(config.destinationUrl);

  const headers: Record<string, string> = { "content-type": mediaType };
  if (config.bearerToken !== undefined) {
    headers.authorization = `Bearer ${config.bearerToken}`;
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(
      config.destinationUrl,
      {
        method: "POST",
        headers,
        body: JSON.stringify(document),
        // No redirect past the validated destination — mirrors the alerting transports' SSRF rationale.
        redirect: "error",
      },
      config.timeoutMs !== undefined ? { timeoutMs: config.timeoutMs } : {},
    );
  } catch (err) {
    throw new InternalError("OSCAL export delivery failed", {
      document: label,
      cause: err instanceof Error ? err.name : "unknown_error",
    });
  }
  if (!res.ok) {
    throw new InternalError("OSCAL export delivery failed", {
      document: label,
      status: res.status,
    });
  }
}

/**
 * Live implementation of {@link OscalExportTransport}: POSTs the SAR then the POA&M to the
 * configured GRC ingest endpoint over {@link fetchWithTimeout} (never a bare `fetch`), Bearer-gated
 * when `bearerToken` is configured. Fails closed on the first non-2xx or transport error — the POA&M
 * is not sent if the SAR delivery failed, and no partial-delivery retry is attempted.
 *
 * `assertDestinationSafe` defaults to the real kernel {@link assertSafePublicUrlResolved} guard
 * (DNS-resolved, so a public name that rebinds to a private/metadata address is caught too); the
 * override exists purely for tests to exercise a real loopback server without weakening what
 * production actually calls.
 */
export function createOscalHttpTransport(
  config: OscalDeliveryConfig,
  assertDestinationSafe: AssertDestinationSafe = assertSafePublicUrlResolved,
): OscalExportTransport {
  return {
    async deliver(bundle: OscalExportBundle): Promise<void> {
      await postOscalDocument(
        config,
        bundle.assessmentResults,
        OSCAL_MEDIA_TYPE.assessmentResults,
        "assessment-results",
        assertDestinationSafe,
      );
      await postOscalDocument(
        config,
        bundle.planOfActionAndMilestones,
        OSCAL_MEDIA_TYPE.poam,
        "poam",
        assertDestinationSafe,
      );
    },
  };
}
