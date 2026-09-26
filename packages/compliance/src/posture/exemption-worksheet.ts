/**
 * Regulatory-exemption -> output-constraint posture worksheet.
 *
 * A convention + typed artifact for turning a legal exemption or safe-harbor's own TEST ELEMENTS
 * (the conditions a claim/output must satisfy to stay inside it -- e.g. an FTC endorsement
 * disclosure requirement, a HIPAA marketing-authorization carve-out) into concrete, checkable
 * LLM-OUTPUT RULES a copy-review or guardrail step can enforce, plus a human sign-off field so the
 * worksheet is legible as "reviewed" vs "draft."
 *
 * This is deliberately NOT a rules engine, a framework, or a new CI/SHIP gate -- it is a typed
 * shape a compliance/legal team fills in by hand (see `exemplar-ftc-endorsement.ts`) and a future
 * gate could point at. Every worksheet carries a fixed disclaimer (`NOT_LEGAL_ADVICE`, enforced by
 * the schema, not left to authoring discipline): this module ships no legal conclusions of its
 * own, only a structured place to record someone else's.
 *
 * Mirrors the `defineControl`/`defineFramework` idiom (`../registry/control.ts`): typed Zod
 * `.strict()` builders that parse-and-validate at author time and fail closed on the first
 * violation. Depends only on `@caisson-sh/kernel` (the down-only floor, ADR-0003).
 */
import { z } from "zod";
import { parseStrict, strictObject } from "@caisson-sh/kernel";

/**
 * Fixed disclaimer every worksheet must carry verbatim. A `z.literal` on this constant means an
 * author cannot soften, omit, or reword it -- the schema enforces the caveat, not a style guide.
 */
export const NOT_LEGAL_ADVICE =
  "This worksheet is a documentation convention for capturing a compliance/legal team's own " +
  "determination in a structured, auditable shape. It is NOT legal advice and asserts no legal " +
  "conclusion of its own; consult qualified counsel before relying on any exemption or safe harbor.";

/** How a mapped output rule is enforced today. */
export const EnforcementMode = z.enum([
  "automated-guardrail",
  "human-review",
  "untracked",
]);
export type EnforcementMode = z.infer<typeof EnforcementMode>;

/** One legal-test-element -> LLM-output-rule mapping row. */
export const ExemptionOutputRule = strictObject({
  /** The exemption/safe-harbor's own test element, stated in the regulator's/statute's terms. */
  legalTestElement: z.string().trim().min(1).max(500),
  /** The concrete, checkable rule an LLM's output must satisfy to stay inside that element. */
  outputRule: z.string().trim().min(1).max(500),
  /** How the rule is enforced today -- an automated gate, a human check, or (flagged) untracked. */
  enforcement: EnforcementMode,
  /** Free-text note -- edge cases, ambiguity, or a citation to the underlying statute/rule text. */
  note: z.string().trim().min(1).max(1000).optional(),
});
export type ExemptionOutputRule = z.infer<typeof ExemptionOutputRule>;
export type ExemptionOutputRuleInput = z.input<typeof ExemptionOutputRule>;

/**
 * Human sign-off. The worksheet is a draft until a named reviewer signs it -- this field is what
 * lets a future gate (out of scope here) tell "reviewed" apart from "someone's first pass."
 */
export const WorksheetSignOff = strictObject({
  reviewerName: z.string().trim().min(1).max(200),
  reviewerRole: z.string().trim().min(1).max(200),
  signedAt: z.string().datetime({ offset: true }),
  /** Caveat the reviewer attaches to their sign-off (e.g. "US-only", "v1 landing-page copy only"). */
  scope: z.string().trim().min(1).max(500).optional(),
});
export type WorksheetSignOff = z.infer<typeof WorksheetSignOff>;
export type WorksheetSignOffInput = z.input<typeof WorksheetSignOff>;

/**
 * A regulatory-exemption -> output-constraint posture worksheet: the exemption being relied on,
 * its test-element -> output-rule mapping, and (once reviewed) a human sign-off. `signOff` is
 * optional on purpose -- an unsigned worksheet is a draft, not yet a posture a gate could point to.
 */
export const ExemptionPostureWorksheet = strictObject({
  /** Worksheet id, kebab-case (e.g. `ftc-endorsement-disclosure`). */
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a kebab-case worksheet id"),
  /** Human title, e.g. "FTC Endorsement Guides -- material connection disclosure". */
  title: z.string().trim().min(1).max(200),
  /** The exemption / safe harbor this worksheet documents an output posture for. */
  exemption: z.string().trim().min(1).max(300),
  /** Plain-language jurisdiction/regulator context (e.g. "US -- FTC", "US -- HHS/OCR HIPAA"). */
  jurisdiction: z.string().trim().min(1).max(200),
  /** Fixed, non-overridable disclaimer -- see `NOT_LEGAL_ADVICE` above. */
  disclaimer: z.literal(NOT_LEGAL_ADVICE),
  rules: z
    .array(ExemptionOutputRule)
    .min(
      1,
      "a worksheet must map at least one legal-test-element to an output rule",
    )
    .refine(
      (rs) => new Set(rs.map((r) => r.legalTestElement)).size === rs.length,
      {
        message: "legal-test-elements must be unique within a worksheet",
      },
    ),
  signOff: WorksheetSignOff.optional(),
});
export type ExemptionPostureWorksheet = z.infer<
  typeof ExemptionPostureWorksheet
>;
export type ExemptionPostureWorksheetInput = z.input<
  typeof ExemptionPostureWorksheet
>;

/**
 * Author one posture worksheet. Validates at call time and returns the fully-defaulted worksheet;
 * throws a redaction-safe `ValidationError` on any violation (including a missing/altered
 * disclaimer or a duplicated legal-test-element).
 */
export function defineExemptionWorksheet(
  worksheet: ExemptionPostureWorksheetInput,
): ExemptionPostureWorksheet {
  return parseStrict(ExemptionPostureWorksheet, worksheet);
}
