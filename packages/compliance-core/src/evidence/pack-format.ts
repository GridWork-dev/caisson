// src/evidence/pack-format.ts — the typed evidence-pack manifest format (ADR-0058).
//
// This is the DETERMINISM CONTRACT the generator must satisfy — the typed, Zod-`.strict()`
// shape of the canonical evidence-pack body, plus the BLOCKED-case report. It carries NO assembly
// logic (no collector running, no clock, no ZIP, no signing): those live in the generator and signer.
// Authoring the format + its golden fixtures BEFORE the generator is the golden-file-before-logic
// gate (ADR-0013/0058) — the generator is written to reproduce a body that already matches this shape.
//
// Two honesty invariants are enforced HERE, at the type boundary, so the generator cannot regress
// them (no false attestation):
//   1. The canonical body EXCLUDES the timestamp and the signature. Both are injected at the edge
//      (the generator stamps the clock, the signer signs `canonicalize(manifest) ∥ anchor.tipHash`);
//      `.strict()` rejects either field inside the body. Excluding them is what keeps the body
//      byte-stable so the same evidence canonicalizes to the same bytes regardless of when/who
//      generated it.
//   2. Flag-never-guess. A manifest evidence item can only be `pass` or `flagged` — `unresolved`
//      has NO representation in a manifest: it hard-blocks generation, surfacing instead through
//      `evidencePackBlockedSchema` (no partial pack). A `flagged` item REQUIRES a recorded reason;
//      readiness is DERIVED from evidence (a control is `gap` iff any item is flagged), never
//      asserted independently; the summary counts must agree with the controls; and posture copy
//      may never claim "compliant"/"certified" (readiness language only).
import { z } from "zod";
import { strictObject, parseStrict } from "@caisson-sh/kernel";
import type { JsonValue } from "@caisson-sh/kernel";
// The BROWSER entry, not the `.` barrel (ADR-0396): `CrosswalkReference` is a VALUE import (a Zod
// schema), so the specifier decides whether this format module drags frameworks-pack's node-only
// half into every graph that reaches it. Same object either way — `./browser` re-exports the very
// module `.` does; the narrower specifier is what lets `assemble.ts` ride the browser entry.
import { CrosswalkReference } from "@caisson-sh/frameworks-pack/browser";
import { crosswalkRollupSchema } from "./crosswalk-rollup.ts";

/**
 * The evidence-pack format version. Append-only (ADR-0006): a breaking shape change mints a new
 * version, never an in-place edit — old packs stay verifiable against the format they were sealed
 * under. v1 -> v2 (ADR-0333/ADR-0347): adds the required `crosswalkRollup` section (the
 * cross-framework evidence rollup, PLAN Group B). Each staged feature owns exactly one bump — named
 * attestations (ADR-0333 Fork D) are a distinct, later migration (v2 -> v3, ADR-0347 Fork G4), not
 * folded into this one.
 */
export const EVIDENCE_PACK_FORMAT_VERSION = "2" as const;

const SHA256_HEX = /^[0-9a-f]{64}$/;

/** A canonical (Caisson-authored) control id — uppercase segments joined by `.`/`-`, mirrors `control.ts`. */
const canonicalControlId = z
  .string()
  .regex(
    /^[A-Z0-9]+(?:[.-][A-Z0-9]+)*$/,
    "must be an uppercase canonical control id (e.g. AUDIT.IMMUTABLE-LOG)",
  );

/** A bounded, trimmed identifier (collector id, tenant id). */
const collectorId = z.string().trim().min(1).max(200);
const tenantId = z.string().trim().min(1).max(200);

/**
 * A recursive JSON value — the only thing a collector's `facts` may contain, so the body survives
 * `canonicalize` (ADR-0052) byte-for-byte. Numbers must be finite (non-finite is not JSON and the
 * canonicalizer throws on it); `Date`/`undefined` are excluded by construction.
 */
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

/** The framework pack this evidence body covers (id/title/version — no control content). */
export const evidencePackFramework = strictObject({
  id: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a kebab-case framework slug"),
  title: z.string().trim().min(1).max(200),
  version: z.string().trim().min(1).max(40),
});
export type EvidencePackFramework = z.infer<typeof evidencePackFramework>;

/**
 * The WORM audit-chain anchor this pack is bound to (ADR-0052). The same `{length, tipHash,
 * genesisHash?}` triple `kernel.anchorChain` mints — pinning it is what binds the pack to the
 * evidentiary chain (and what the signer signs alongside the canonical body).
 */
export const evidencePackChainAnchor = strictObject({
  length: z.number().int().positive(),
  tipHash: z.string().regex(SHA256_HEX),
  genesisHash: z.string().regex(SHA256_HEX).optional(),
});
export type EvidencePackChainAnchor = z.infer<typeof evidencePackChainAnchor>;

/** A manual-attachment slot, with whether it was filled at assembly time (edge-tracked). */
const manifestManualSlot = strictObject({
  id: z.string().trim().min(1).max(200),
  label: z.string().trim().min(1).max(500),
  required: z.boolean(),
  filled: z.boolean(),
});

/**
 * One evidence item in the manifest. Status is `pass` | `flagged` ONLY — `unresolved` cannot appear
 * (it blocks the whole pack). A `flagged` item MUST carry a recorded reason; a `pass` item must NOT
 * (the canonical body stays minimal and honest).
 */
export const manifestEvidenceItem = strictObject({
  collectorId,
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(2000),
  status: z.enum(["pass", "flagged"]),
  reason: z.string().trim().min(1).max(2000).optional(),
  facts: z.record(z.string(), jsonValueSchema),
  manualSlots: z.array(manifestManualSlot),
}).superRefine((item, ctx) => {
  if (item.status === "flagged" && item.reason === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message:
        "a flagged evidence item requires a recorded reason (flag-never-guess, ADR-0058)",
    });
  }
  if (item.status === "pass" && item.reason !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message: "a passing evidence item must not carry a reason",
    });
  }
});
export type ManifestEvidenceItem = z.infer<typeof manifestEvidenceItem>;

/**
 * One control's evidence block. `readiness` is DERIVED, not asserted: a control is `gap` iff any of
 * its evidence items is flagged, `ready` iff all pass. A control must carry at least one item — a
 * control with no evidence would be `unresolved`, which blocks the pack rather than appearing here.
 */
export const manifestControl = strictObject({
  controlId: canonicalControlId,
  title: z.string().trim().min(1).max(200),
  family: z.string().trim().min(1).max(120),
  statement: z.string().trim().min(1).max(2000),
  crosswalk: z.array(CrosswalkReference),
  evidence: z.array(manifestEvidenceItem).min(1),
  readiness: z.enum(["ready", "gap"]),
}).superRefine((control, ctx) => {
  const expected = control.evidence.some((e) => e.status === "flagged")
    ? "gap"
    : "ready";
  if (control.readiness !== expected) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["readiness"],
      message: `readiness must be "${expected}" — derived from evidence (gap iff any item flagged), never asserted independently`,
    });
  }
});
export type ManifestControl = z.infer<typeof manifestControl>;

/** Posture copy — readiness language only; "compliant"/"certified" claims are rejected (ADR-0058). */
const postureCopy = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .refine((s) => !/\b(compliant|certified)\b/i.test(s), {
    message:
      'posture copy must use readiness language, never claim "compliant"/"certified" (ADR-0058)',
  });

/** The auditor-facing rollup. Every count is DERIVED from `controls` (cross-checked at the manifest level). */
export const manifestSummary = strictObject({
  totalControls: z.number().int().nonnegative(),
  controlsReady: z.number().int().nonnegative(),
  controlsWithGaps: z.number().int().nonnegative(),
  totalEvidenceItems: z.number().int().nonnegative(),
  posture: postureCopy,
});

/**
 * The canonical evidence-pack manifest — the body that `canonicalize`s to byte-stable bytes and
 * that the signer signs. EXCLUDES the generation timestamp and the signature (injected at the edge);
 * `.strict()` rejects either inside the body. The summary counts MUST agree with `controls`.
 */
export const evidencePackManifestSchema = strictObject({
  formatVersion: z.literal(EVIDENCE_PACK_FORMAT_VERSION),
  tenantId,
  framework: evidencePackFramework,
  chainAnchor: evidencePackChainAnchor,
  controls: z.array(manifestControl).min(1),
  summary: manifestSummary,
  /**
   * The cross-framework evidence rollup (ADR-0333/ADR-0347, v2) — a pure join over every shipped
   * pack's crosswalk pointers, computed by the caller (`computeCrosswalkRollup`) and assembled here
   * unchanged (derived-not-asserted, like `summary`). Required in v2; may be an empty cell list when
   * this run's controls carry no crosswalk pointers.
   */
  crosswalkRollup: crosswalkRollupSchema,
}).superRefine((m, ctx) => {
  const totalControls = m.controls.length;
  const controlsReady = m.controls.filter(
    (c) => c.readiness === "ready",
  ).length;
  const controlsWithGaps = m.controls.filter(
    (c) => c.readiness === "gap",
  ).length;
  const totalEvidenceItems = m.controls.reduce(
    (n, c) => n + c.evidence.length,
    0,
  );
  const mismatches: ReadonlyArray<readonly [string, number, number]> = [
    ["totalControls", m.summary.totalControls, totalControls],
    ["controlsReady", m.summary.controlsReady, controlsReady],
    ["controlsWithGaps", m.summary.controlsWithGaps, controlsWithGaps],
    ["totalEvidenceItems", m.summary.totalEvidenceItems, totalEvidenceItems],
  ];
  for (const [field, got, want] of mismatches) {
    if (got !== want) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["summary", field],
        message: `summary.${field} must equal the derived value ${String(want)} (no fabricated counts, ADR-0058)`,
      });
    }
  }
});
export type EvidencePackManifest = z.infer<typeof evidencePackManifestSchema>;

/**
 * The BLOCKED-case report (flag-never-guess, ADR-0058). When ANY control's evidence is `unresolved`,
 * NO manifest is assembled — the generator throws, surfacing this body so the buyer knows
 * exactly which evidence is absent. There is no partial pack: this report is the only output of a
 * blocked run, and it lists every unresolved item.
 */
export const evidencePackBlockedSchema = strictObject({
  formatVersion: z.literal(EVIDENCE_PACK_FORMAT_VERSION),
  tenantId,
  framework: evidencePackFramework,
  blocked: z.literal(true),
  unresolved: z
    .array(
      strictObject({
        controlId: canonicalControlId,
        collectorId,
        reason: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1, "a blocked report must list at least one unresolved item"),
});
export type EvidencePackBlocked = z.infer<typeof evidencePackBlockedSchema>;

/** Parse + validate an evidence-pack manifest body, throwing a redaction-safe `ValidationError`. */
export function parseEvidencePackManifest(
  input: unknown,
): EvidencePackManifest {
  return parseStrict(evidencePackManifestSchema, input);
}

/** Parse + validate a BLOCKED-case report, throwing a redaction-safe `ValidationError`. */
export function parseEvidencePackBlocked(input: unknown): EvidencePackBlocked {
  return parseStrict(evidencePackBlockedSchema, input);
}
