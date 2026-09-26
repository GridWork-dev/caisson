// src/soa/iso-27001-soa.ts — the ISO/IEC 27001:2022 Statement of Applicability (SoA) row computation.
//
// A PURE function (no I/O, no clock, no id minting — mirrors `crosswalk-rollup.ts`'s own seam
// discipline): the caller supplies the SCOPE (`controlIds` — the Annex A control ids the adopter's
// ISMS puts in scope; this module carries no hardcoded Annex A catalog, deliberately, since the
// adopter's own ISMS scoping decision is theirs, never Caisson's to assert) plus the ISO/IEC
// 27001:2022 `iso27001Crosswalk` (`../crosswalks/regimes.ts`) and a per-canonical-control-id
// evidence-status map (the same shape `computeCrosswalkRollup`'s caller in `@caisson-sh/compliance-core`
// already builds from a collector run). Lives in `@caisson-sh/frameworks-pack` — NOT `compliance-core` —
// because dependencies are down-only (ADR-0003): `compliance-core` depends on `frameworks-pack`, never
// the reverse, so a function needing the `CrosswalkRollup` type would have to live one level up from
// here; this one only needs the crosswalk row shape this package already owns.
//
// FLAG-NEVER-GUESS (the invariant every evidence surface in this repo carries, ADR-0058): a control
// id with NO matching `iso27001Crosswalk` row renders `applicable: "unresolved"` — never a guessed
// "applicable" or "not-applicable". Caisson maps only the technical controls it actually ships;
// whether an Annex A control the crosswalk doesn't cover applies to the adopter's ISMS is the adopter's
// own scoping call, which this function never makes for them.
import { z } from "zod";
import { strictObject, parseStrict, ValidationError } from "@caisson-sh/kernel";
import type { RegimeCrosswalk } from "@caisson-sh/oscal-spine";

/** Per-canonical-control-id evidence status for one pack run — mirrors
 *  `@caisson-sh/compliance-core`'s `ControlStatus` (duplicated, not imported: down-only dependency
 *  direction forbids this package from depending on compliance-core). */
export type ControlEvidenceStatus = "ready" | "gap" | "unresolved";

const controlEvidenceStatus = z.enum(["ready", "gap", "unresolved"]);

/** Own-authored, readiness-language-only fallback justification for a control with no crosswalk row.
 *  Never asserts an applicability answer Caisson isn't positioned to make. */
const NO_CROSSWALK_JUSTIFICATION =
  "No Caisson crosswalk row maps this control to a shipped technical mechanism; applicability is " +
  "not resolved by this generator and remains the adopter's own ISMS scoping decision.";

/** One Statement of Applicability row. `applicable` is `"unresolved"` — never a guessed answer —
 *  whenever no crosswalk row exists for the control (flag-never-guess). */
export const soaRowSchema = strictObject({
  /** The Annex A control id (e.g. `A.5.15`), verbatim from the caller's `controlIds` scope. */
  control: z.string().trim().min(1).max(80),
  applicable: z.enum(["applicable", "unresolved"]),
  /** Own-authored rationale — never the ISO/IEC 27001 requirement text itself (clean-room). */
  justification: z.string().trim().min(1).max(600),
  status: controlEvidenceStatus,
  /** The canonical control id backing this row, when the crosswalk resolved one. */
  evidencePointer: z
    .string()
    .regex(/^[A-Z0-9]+(?:[.-][A-Z0-9]+)*$/)
    .optional(),
});
export type SoaRow = z.infer<typeof soaRowSchema>;
export type SoaRowInput = z.input<typeof soaRowSchema>;

export interface ComputeIso27001SoaRowsInput {
  /** The Annex A control ids in the adopter's ISMS scope — caller-supplied, never inferred here. */
  readonly controlIds: readonly string[];
  /** Must be the ISO/IEC 27001:2022 regime crosswalk (`regime: "iso-27001"`) — fails closed otherwise. */
  readonly crosswalk: RegimeCrosswalk;
  /** Per-canonical-control-id evidence status for this run. A control absent from the map — or a
   *  crosswalk row with no `canonicalControlId` — resolves to `"unresolved"`, never `"ready"`. */
  readonly controlStatuses: ReadonlyMap<string, ControlEvidenceStatus>;
}

/** Locale-independent lexicographic comparator (mirrors `crosswalk-rollup.ts`'s own `cmp`). */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Compute the ISO/IEC 27001:2022 Statement of Applicability rows for the given control scope. Pure
 * and deterministic: rows are deduped + sorted by control id regardless of `controlIds` input order,
 * so the same scope + crosswalk + statuses always yields byte-identical rows (golden-fixturable).
 * Fails closed with a `ValidationError` if `crosswalk` is not the ISO/IEC 27001:2022 crosswalk.
 */
export function computeIso27001SoaRows(
  input: ComputeIso27001SoaRowsInput,
): SoaRow[] {
  if (input.crosswalk.regime !== "iso-27001") {
    throw new ValidationError(
      'computeIso27001SoaRows requires the ISO/IEC 27001:2022 regime crosswalk (regime: "iso-27001")',
    );
  }

  const sortedIds = [...new Set(input.controlIds)].sort(cmp);
  const rowByControl = new Map(
    input.crosswalk.rows.map((row) => [row.control, row] as const),
  );

  return sortedIds.map((control) => {
    const crosswalkRow = rowByControl.get(control);
    const row: SoaRowInput =
      crosswalkRow === undefined
        ? {
            control,
            applicable: "unresolved",
            justification: NO_CROSSWALK_JUSTIFICATION,
            status: "unresolved",
          }
        : {
            control,
            applicable: "applicable",
            justification: crosswalkRow.summary,
            status:
              crosswalkRow.canonicalControlId === undefined
                ? "unresolved"
                : (input.controlStatuses.get(crosswalkRow.canonicalControlId) ??
                  "unresolved"),
            ...(crosswalkRow.canonicalControlId !== undefined
              ? { evidencePointer: crosswalkRow.canonicalControlId }
              : {}),
          };
    return parseStrict(soaRowSchema, row);
  });
}
