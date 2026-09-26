// src/evidence/oscal-bundle.ts — OSCAL signed evidence-bundle assembler (ADR-0231).
//
// The final delivery shape ADR-0231 locked (Option 1): a sibling-directory bundle that makes the SAR's
// Assessment-Plan `rlink` honestly resolvable WITHOUT a hosted route. It co-locates the real per-framework
// AP (`oscal-assessment-plan.ts`), the SAR, the POA&M, the canonical manifest, and its detached
// Ed25519 signature — then rewrites the SAR's back-matter `rlink.href` to the RELATIVE in-bundle AP path
// with a SHA-256 `hashes[]` binding over the exact bundled AP bytes. A buyer's GRC tooling resolves the
// reference relative to the doc's own location (OSCAL relative-URI resolution) — no `caisson.sh` URL served.
//
// PURE + DETERMINISM: a single injected `now`/`newId` seam feeds the AP, SAR, and POA&M in a fixed order,
// so every UUID is globally unique and the whole bundle (and thus the AP `hashes[]`) is byte-stable. The
// only side-effect-shaped step is `signEvidencePack()` (async Ed25519), reused UNCHANGED — no new crypto.
//
// NO TRANSPORT, NO FILE WRITE (ADR-0047 seam ethos): the assembler RETURNS the relative-path→bytes map a
// caller writes to disk / archives to the WORM store (`audit-worm/store.s3.ts`); it never touches a network.
import { createHash } from "node:crypto";
import { canonicalize, type JsonValue } from "@caisson-sh/kernel";
import {
  toOscalAssessmentPlan,
  toOscalAssessmentResults,
  toOscalPlanOfActionAndMilestones,
  type EvidencePackManifest,
  type OscalAssessmentPlanDocument,
  type OscalAssessmentResultsDocument,
  type OscalExportOptions,
  type OscalPlanOfActionAndMilestonesDocument,
} from "@caisson-sh/compliance-core";
import {
  signEvidencePack,
  type EvidenceSignature,
  type SignEvidencePackOptions,
  type Signer,
} from "@caisson-sh/signing-primitive";

/** Fixed bundle layout (ADR-0231, sibling-directory sub-fork) — relative to the bundle root. */
const SAR_PATH = "./sar.json" as const;
const POAM_PATH = "./poam.json" as const;
const MANIFEST_PATH = "./manifest.json" as const;
const SIGNATURE_PATH = "./manifest.sig" as const;

/** The relative in-bundle path (and SAR `rlink.href`) for a framework's Assessment-Plan. */
function assessmentPlanPath(frameworkId: string): string {
  return `./assessment-plan/${frameworkId}.json`;
}

/** Round-trip to a genuine `JsonValue` (drops `undefined`) so `canonicalize` accepts the value. */
function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

/** The exact canonical (byte-stable) bytes a document is written as in the bundle. */
function canonicalBytes(value: unknown): string {
  return canonicalize(toJsonValue(value));
}

/** SHA-256 (lowercase hex) over UTF-8 canonical bytes — the integrity value bound into `rlink.hashes[]`. */
function sha256Hex(canonical: string): string {
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/** An assembled OSCAL signed evidence bundle (ADR-0231). */
export interface AssembledOscalBundle {
  /**
   * Relative-path → exact UTF-8 file bytes to write into the bundle directory (the SAR `rlink` resolves
   * within this map). Keys: `./assessment-plan/<framework>.json`, `./sar.json`, `./poam.json`,
   * `./manifest.json`, `./manifest.sig`.
   */
  readonly files: Readonly<Record<string, string>>;
  /** The per-framework Assessment-Plan document (bytes at `assessmentPlanPath`). */
  readonly assessmentPlan: OscalAssessmentPlanDocument;
  /** The SAR — rewritten with the RELATIVE AP `rlink.href` + SHA-256 `hashes[]` (bytes at `./sar.json`). */
  readonly assessmentResults: OscalAssessmentResultsDocument;
  /** The POA&M document (bytes at `./poam.json`). */
  readonly planOfActionAndMilestones: OscalPlanOfActionAndMilestonesDocument;
  /** The detached Ed25519 signature over the manifest (bytes at `./manifest.sig`). */
  readonly signature: EvidenceSignature;
  /** The relative in-bundle AP path the SAR `rlink.href` points at. */
  readonly assessmentPlanHref: string;
  /** SHA-256 of the canonicalized bundled AP bytes (matches the SAR `rlink.hashes[0].value`). */
  readonly assessmentPlanSha256: string;
}

/**
 * Assemble an OSCAL signed evidence bundle from an evidence-pack manifest (ADR-0231). Authors the framework's AP,
 * hashes its canonical bytes, builds the SAR with the AP `rlink` rewritten to the relative in-bundle path
 * + `hashes[]`, builds the POA&M, and signs the manifest with the per-tenant signer (reused unchanged).
 *
 * Deterministic given an injected `now` + a shared `newId` closure (fed to the AP, SAR, and POA&M in a
 * fixed order). Async only because Ed25519 signing is.
 */
export async function assembleOscalEvidenceBundle(
  manifest: EvidencePackManifest,
  signer: Signer,
  options: OscalExportOptions,
  signOptions?: SignEvidencePackOptions,
): Promise<AssembledOscalBundle> {
  const apDoc = toOscalAssessmentPlan(manifest.framework, options);
  const apBytes = canonicalBytes(apDoc);
  const apSha256 = sha256Hex(apBytes);
  const apHref = assessmentPlanPath(manifest.framework.id);

  const sar = toOscalAssessmentResults(manifest, {
    ...options,
    assessmentPlan: { rlinkHref: apHref, sha256: apSha256 },
  });
  const poam = toOscalPlanOfActionAndMilestones(manifest, options);
  const signature = await signEvidencePack(signer, manifest, signOptions);

  const files: Record<string, string> = {
    [apHref]: apBytes,
    [SAR_PATH]: canonicalBytes(sar),
    [POAM_PATH]: canonicalBytes(poam),
    [MANIFEST_PATH]: canonicalBytes(manifest),
    [SIGNATURE_PATH]: canonicalBytes(signature),
  };

  return {
    files,
    assessmentPlan: apDoc,
    assessmentResults: sar,
    planOfActionAndMilestones: poam,
    signature,
    assessmentPlanHref: apHref,
    assessmentPlanSha256: apSha256,
  };
}
