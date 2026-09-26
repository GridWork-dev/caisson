/**
 * Control registry builders (ADR-0057). The compliance edition models compliance as
 * config-as-code: a **clean-room, own-authored canonical control set** plus per-framework
 * crosswalk references that map each canonical control to an external framework's requirement
 * id. NEVER ingest/copy/transform any NoDerivatives-licensed catalog (SCF, CC-BY-ND, first among
 * them) -- the ban is ND-specific (ADR-0057 as narrowed by ADR-0333): public-domain/CC0 reference
 * material (NIST OLIR mappings, SP 800-66r2) may seed or check crosswalk MAPPING ROWS as pointers
 * with provenance. The catalog itself stays authored by hand; crosswalk references are pointers
 * only, never copied control text.
 *
 * Mirrors the `defineModule` precedent (packages/registry-schema/src/module-manifest.ts): typed Zod `.strict()`
 * builders that parse-and-validate at author time and fail closed on the first violation. Depends
 * only on `@caisson/kernel` (the down-only floor, ADR-0003) -- no edition or sibling-primitive dep.
 *
 * This module is ALSO the package's `"./registry"` entry point, and it is browser-safe: it reaches
 * only the node-free `@caisson/kernel` `.` barrel. The package's own `.` barrel is NOT browser-safe
 * — it re-exports `@caisson/oscal-spine`, whose delivery transport and vendored-catalog reader are
 * irreducibly node-only (node:child_process / node:fs in oscal-export-xml.ts and
 * nist-catalog-controls.ts). A bundle consumer imports `@caisson/frameworks-pack/browser` for the
 * model + packs + browser-safe OSCAL surface together (ADR-0396), or `./registry` for the model
 * alone.
 */
import { z } from "zod";
import { parseStrict, strictObject } from "@caisson/kernel";

/**
 * Canonical control id -- Caisson-authored, framework-agnostic. Uppercase alphanumeric segments
 * joined by `.`/`-` (e.g. `ACCESS-CONTROL.MFA`, `AUDIT.IMMUTABLE-LOG`). Strict because we own
 * the namespace; external requirement ids (which carry parens/lowercase) live in `reference`.
 */
const canonicalControlId = z
  .string()
  .regex(
    /^[A-Z0-9]+(?:[.-][A-Z0-9]+)*$/,
    "must be an uppercase canonical control id (e.g. ACCESS-CONTROL.MFA)",
  );

/** Framework slug -- kebab-case, mirrors the per-framework file names (soc2-tsc, hipaa-security). */
const frameworkId = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a kebab-case framework slug");

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Structured provenance for a crosswalk mapping (ADR-0333/CR-10; replaces the never-shipped
 * `verified: boolean`). `status` gates claim propagation (only `reviewed`/`expert-reviewed`
 * mappings can ever back an `implements` rollup cell -- ADR-0333 Fork E); `relationship` records
 * how tightly the mapping actually corresponds; `sourceId`/`sourceVersion`/`sourceDigest` pin the
 * material a reviewer checked the mapping against, and `reviewedBy`/`reviewedAt` are the audit
 * trail. A source-digest change is meant to invalidate the review (reverting it to `unreviewed`) --
 * see `isVerificationStale` below; v1 has no live re-ingestion pipeline to auto-detect that drift,
 * so this stays a documented + tested convention (ADR-0333 Fork A/B: no spine, no vendored catalog).
 */
export const CrosswalkVerification = strictObject({
  status: z.enum(["unreviewed", "reviewed", "expert-reviewed"]),
  relationship: z.enum(["related", "partial", "equivalent"]),
  /** What was reviewed against (e.g. a proof-test path, an OLIR mapping id). Bounded, not patterned. */
  sourceId: z.string().trim().min(1).max(120),
  sourceVersion: z.string().trim().min(1).max(80),
  sourceDigest: z.string().regex(SHA256_HEX),
  reviewedBy: z.string().trim().min(1).max(200),
  reviewedAt: z.string().trim().min(1).max(40),
});
export type CrosswalkVerification = z.infer<typeof CrosswalkVerification>;

/**
 * A crosswalk reference: a pointer from a canonical control to an external framework's requirement
 * id (e.g. SOC2-TSC `CC6.1`, HIPAA-Security `164.312(a)(2)(i)`). `reference` is an opaque, bounded
 * label -- external ids carry parens/lowercase/citation syntax, so it is not pattern-constrained.
 * No external control TEXT is stored here (licensing floor, ADR-0057).
 */
export const CrosswalkReference = strictObject({
  /** External framework label, e.g. `SOC2-TSC`, `HIPAA-Security`, `NIST-800-53`. */
  framework: z.string().trim().min(1).max(80),
  /** The external requirement id this canonical control maps to. */
  reference: z.string().trim().min(1).max(200),
  /** Optional clarifying note on the nature of the mapping (own-authored). */
  note: z.string().trim().min(1).max(500).optional(),
  /**
   * Optional structured provenance (ADR-0333) -- additive, `.strict()`-safe. Absent means
   * `unreviewed`-equivalent: the rollup (compliance-core) never renders `implements` for a
   * mapping with no `verification` record.
   */
  verification: CrosswalkVerification.optional(),
});
export type CrosswalkReference = z.infer<typeof CrosswalkReference>;
export type CrosswalkReferenceInput = z.input<typeof CrosswalkReference>;

/**
 * Whether a mapping's recorded review is stale against the source it was reviewed against
 * (ADR-0333: a source-digest change invalidates dependent verification). `undefined` verification
 * (never reviewed) counts as stale. `currentSourceDigest` is the live digest of `sourceId` --
 * ponytail: v1 has no ingestion pipeline that re-hashes an external source at runtime (A2), so
 * every call site today passes the record's own `sourceDigest` back as "current" (never stale by
 * construction); a future source-refresh pipeline (e.g. an OLIR re-pull) supplies a real live
 * digest here instead, and this same check starts catching real drift.
 */
export function isVerificationStale(
  verification: CrosswalkVerification | undefined,
  currentSourceDigest: string,
): boolean {
  if (verification === undefined) return true;
  return verification.sourceDigest !== currentSourceDigest;
}

/**
 * A single canonical control: the own-authored requirement plus its crosswalk references. Crosswalk
 * references must be unique on `(framework, reference)` -- a duplicated mapping is an authoring bug.
 */
export const CanonicalControl = strictObject({
  id: canonicalControlId,
  /** Short human title. */
  title: z.string().trim().min(1).max(200),
  /** Control family / domain (e.g. `Access Control`, `Audit & Accountability`). */
  family: z.string().trim().min(1).max(120),
  /** Own-authored requirement statement (clean-room -- never copied from a third-party catalog). */
  statement: z.string().trim().min(1).max(2000),
  /** Optional implementation guidance. */
  guidance: z.string().trim().min(1).max(4000).optional(),
  /** Crosswalk references to external framework requirement ids; empty for a Caisson-only control. */
  crosswalk: z
    .array(CrosswalkReference)
    .default([])
    .refine(
      (xs) =>
        new Set(xs.map((x) => JSON.stringify([x.framework, x.reference])))
          .size === xs.length,
      {
        message:
          "crosswalk references must be unique on (framework, reference)",
      },
    ),
});
export type CanonicalControl = z.infer<typeof CanonicalControl>;
export type CanonicalControlInput = z.input<typeof CanonicalControl>;

/**
 * A framework catalog: a named, versioned set of canonical controls. Control ids must be unique
 * within the framework, and a framework must declare at least one control (an empty named slot --
 * e.g. the EU-AI-Act reservation -- is a manifest concern, not a `defineFramework` call).
 */
export const Framework = strictObject({
  id: frameworkId,
  /** Human title, e.g. `SOC 2 -- Trust Services Criteria`. */
  title: z.string().trim().min(1).max(200),
  /** Caisson catalog version for this authored framework pack (e.g. `2024.1`). */
  version: z.string().trim().min(1).max(40),
  /** Short description of the framework's scope. */
  description: z.string().trim().min(1).max(1000),
  controls: z
    .array(CanonicalControl)
    .min(1, "a framework must declare at least one control")
    .refine((cs) => new Set(cs.map((c) => c.id)).size === cs.length, {
      message: "control ids must be unique within a framework",
    }),
});
export type Framework = z.infer<typeof Framework>;
export type FrameworkInput = z.input<typeof Framework>;

/**
 * Author one canonical control. Validates at call time and returns the fully-defaulted control
 * (e.g. `crosswalk` defaults to `[]`); throws a redaction-safe `ValidationError` on any violation.
 */
export function defineControl(
  control: CanonicalControlInput,
): CanonicalControl {
  return parseStrict(CanonicalControl, control);
}

/**
 * Author one framework catalog from its canonical controls. Re-validates every control (idempotent
 * on already-built controls), enforces id uniqueness, and fails closed on the first violation.
 */
export function defineFramework(framework: FrameworkInput): Framework {
  return parseStrict(Framework, framework);
}
