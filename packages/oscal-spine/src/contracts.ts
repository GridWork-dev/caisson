import { z } from "zod";
import { parseStrict, strictObject, ValidationError } from "@caisson-sh/kernel";

const SHA256_HEX = /^[0-9a-f]{64}$/;
const CANONICAL_CONTROL_ID = /^[A-Z0-9]+(?:[.-][A-Z0-9]+)*$/;

type OscalJsonValue =
  | string
  | number
  | boolean
  | null
  | OscalJsonValue[]
  | { [key: string]: OscalJsonValue };

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

const jsonValueSchema: z.ZodType<OscalJsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const crosswalkVerificationSchema = strictObject({
  status: z.enum(["unreviewed", "reviewed", "expert-reviewed"]),
  relationship: z.enum(["related", "partial", "equivalent"]),
  sourceId: z.string().trim().min(1).max(120),
  sourceVersion: z.string().trim().min(1).max(80),
  sourceDigest: z.string().regex(SHA256_HEX),
  reviewedBy: z.string().trim().min(1).max(200),
  reviewedAt: z.string().trim().min(1).max(40),
});

const crosswalkReferenceSchema = strictObject({
  framework: z.string().trim().min(1).max(80),
  reference: z.string().trim().min(1).max(200),
  note: z.string().trim().min(1).max(500).optional(),
  verification: crosswalkVerificationSchema.optional(),
});

const manualSlotSchema = strictObject({
  id: z.string().trim().min(1).max(200),
  label: z.string().trim().min(1).max(500),
  required: z.boolean(),
  filled: z.boolean(),
});

const manifestEvidenceItemSchema = strictObject({
  collectorId: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(2000),
  status: z.enum(["pass", "flagged"]),
  reason: z.string().trim().min(1).max(2000).optional(),
  facts: z.record(z.string(), jsonValueSchema),
  manualSlots: z.array(manualSlotSchema),
}).superRefine((item, ctx) => {
  if (item.status === "flagged" && item.reason === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message: "a flagged evidence item requires a recorded reason",
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
export type OscalManifestEvidenceItem = DeepReadonly<
  z.infer<typeof manifestEvidenceItemSchema>
>;

const manifestControlSchema = strictObject({
  controlId: z.string().regex(CANONICAL_CONTROL_ID),
  title: z.string().trim().min(1).max(200),
  family: z.string().trim().min(1).max(120),
  statement: z.string().trim().min(1).max(2000),
  crosswalk: z.array(crosswalkReferenceSchema),
  evidence: z.array(manifestEvidenceItemSchema).min(1),
  readiness: z.enum(["ready", "gap"]),
}).superRefine((control, ctx) => {
  const expected = control.evidence.some((item) => item.status === "flagged")
    ? "gap"
    : "ready";
  if (control.readiness !== expected) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["readiness"],
      message: `readiness must be "${expected}"`,
    });
  }
});
export type OscalManifestControl = DeepReadonly<
  z.infer<typeof manifestControlSchema>
>;

const crosswalkRollupCellSchema = strictObject({
  framework: z.string().trim().min(1).max(80),
  reference: z.string().trim().min(1).max(200),
  // Keep these two pointer arrays byte-for-byte compatible with compliance-core's public
  // CrosswalkRollup contract. They are opaque identifiers at this boundary; tightening them to
  // canonical-control syntax would make a manifest accepted by the parent fail after the carve.
  canonicalControlIds: z.array(z.string()).min(1),
  status: z.enum(["ready", "gap", "unresolved"]),
  claim: z.enum(["maps-to", "implements"]),
  evidencePointers: z.array(z.string()).min(1),
  note: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((value) => !/\b(compliant|certified|verified)\b/i.test(value), {
      message: "rollup note must use readiness language",
    })
    .optional(),
});
export type OscalCrosswalkRollupCell = DeepReadonly<
  z.infer<typeof crosswalkRollupCellSchema>
>;

const crosswalkRollupSchema = strictObject({
  cells: z.array(crosswalkRollupCellSchema),
});
export type OscalCrosswalkRollup = DeepReadonly<
  z.infer<typeof crosswalkRollupSchema>
>;

const evidencePackFrameworkSchema = strictObject({
  id: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a framework slug"),
  title: z.string().trim().min(1).max(200),
  version: z.string().trim().min(1).max(40),
});
export type OscalEvidencePackFramework = DeepReadonly<
  z.infer<typeof evidencePackFrameworkSchema>
>;

const manifestSummarySchema = strictObject({
  totalControls: z.number().int().nonnegative(),
  controlsReady: z.number().int().nonnegative(),
  controlsWithGaps: z.number().int().nonnegative(),
  totalEvidenceItems: z.number().int().nonnegative(),
  posture: z
    .string()
    .trim()
    .min(1)
    .max(1000)
    .refine((value) => !/\b(compliant|certified)\b/i.test(value), {
      message: "posture must use readiness language",
    }),
});

/** Strict, JSON-safe evidence-pack projection accepted by the standalone OSCAL package. */
export const OscalEvidencePackManifestSchema = strictObject({
  formatVersion: z.literal("2"),
  tenantId: z.string().trim().min(1).max(200),
  framework: evidencePackFrameworkSchema,
  chainAnchor: strictObject({
    length: z.number().int().positive(),
    tipHash: z.string().regex(SHA256_HEX),
    genesisHash: z.string().regex(SHA256_HEX).optional(),
  }),
  controls: z.array(manifestControlSchema).min(1),
  summary: manifestSummarySchema,
  crosswalkRollup: crosswalkRollupSchema,
}).superRefine((manifest, ctx) => {
  const derived = {
    totalControls: manifest.controls.length,
    controlsReady: manifest.controls.filter(
      (control) => control.readiness === "ready",
    ).length,
    controlsWithGaps: manifest.controls.filter(
      (control) => control.readiness === "gap",
    ).length,
    totalEvidenceItems: manifest.controls.reduce(
      (count, control) => count + control.evidence.length,
      0,
    ),
  };
  for (const field of [
    "totalControls",
    "controlsReady",
    "controlsWithGaps",
    "totalEvidenceItems",
  ] as const) {
    if (manifest.summary[field] !== derived[field]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["summary", field],
        message: `summary.${field} must equal ${String(derived[field])}`,
      });
    }
  }
});
export type OscalEvidencePackManifest = DeepReadonly<
  z.infer<typeof OscalEvidencePackManifestSchema>
>;

/** Validate the standalone OSCAL input boundary with redaction-safe field-path errors. */
export function parseOscalEvidencePackManifest(
  input: unknown,
): OscalEvidencePackManifest {
  try {
    if (JSON.stringify(input) === undefined) {
      throw new ValidationError(
        "OSCAL evidence-pack manifest must be JSON-safe",
      );
    }
  } catch (error: unknown) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError("OSCAL evidence-pack manifest must be JSON-safe");
  }
  return parseStrict(OscalEvidencePackManifestSchema, input);
}

/** Structural framework-catalog projection consumed by the OSCAL catalog exporter. */
export interface OscalFramework {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  readonly controls: readonly {
    readonly id: string;
    readonly title: string;
    readonly family: string;
    readonly statement: string;
    readonly guidance?: string | undefined;
  }[];
}

/** Structural ISO 27001 SoA row consumed by the OSCAL component-definition exporter. */
export interface OscalSoaRow {
  readonly control: string;
  readonly applicable: "applicable" | "unresolved";
  readonly justification: string;
  readonly status: "ready" | "gap" | "unresolved";
  readonly evidencePointer?: string | undefined;
}

/**
 * The OSCAL model version these bodies are authored against (NIST OSCAL JSON, csrc.nist.gov/ns/oscal).
 * Locked to v1.2.2 (NIST's latest stable, 2026-04-30) by ADR-0179 — the single `oscal-cli validate`
 * conformance target. A FedRAMP-package buyer down-converts (the 1.0.4 dual-target mode is not built).
 */
export const OSCAL_VERSION = "1.2.2" as const;

/** The Caisson property/extension namespace stamped on OSCAL `prop`/`link` extensions. */
export const CAISSON_OSCAL_NS = "https://caisson.sh/ns/oscal";
