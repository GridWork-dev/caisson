// src/citation-row.ts — citation-row rendering: the one canonical shape a "control cites evidence"
// row takes across every consumer (the ISO 27001 SoA, the buyer trust page's crosswalk-rollup table).
// A thin, validated constructor — not a formatter for a specific output format (HTML/JSON stay the
// caller's job) — so both consumers get the SAME field bounds and the SAME readiness-language gate on
// `justification` without re-deriving either.
import { strictObject, parseStrict, type JsonValue } from "@caisson-sh/kernel";
import { z } from "zod";
import { assertReadinessLanguage } from "./filter.ts";

const citationRowSchema = strictObject({
  /** The control/requirement identifier the row is about (e.g. `A.5.15`, `SOC2-TSC CC7.2`). */
  control: z.string().trim().min(1).max(200),
  /** The headline classification (e.g. `applicable`, `unresolved`, `maps-to`, `implements`). */
  claim: z.string().trim().min(1).max(80),
  /** Free-text rationale — gated by the readiness-language filter (ADR-0080) below. */
  justification: z.string().trim().min(1).max(2000),
  /** Where the buyer looks for the evidence backing this row (a control id, a pointer, a path). */
  evidencePointer: z.string().trim().min(1).max(400).optional(),
});

export type CitationRowInput = z.input<typeof citationRowSchema>;
export type CitationRow = z.infer<typeof citationRowSchema>;

/**
 * Build one validated citation row. Fails closed (throws `ValidationError`) on an out-of-bounds field
 * or on `control`, `claim`, or `justification` using a banned claim word — every free-text-ish field,
 * not just the prose one, so a future caller building `control`/`claim` from tenant-derived data
 * (rather than a fixed enum/id) can't smuggle a claim past this shared seam. Deterministic — no
 * clock, no id minting.
 */
export function renderCitationRow(input: CitationRowInput): CitationRow {
  const row = parseStrict(citationRowSchema, input);
  assertReadinessLanguage(row.control, "citation row control");
  assertReadinessLanguage(row.claim, "citation row claim");
  assertReadinessLanguage(row.justification, "citation row justification");
  return row;
}

/** A citation row as a plain JSON value — the shape a caller embeds directly into an OSCAL prop,
 *  an evidence-pack archive entry, or a rendered HTML/JSON artifact. */
export function citationRowToJson(row: CitationRow): JsonValue {
  return {
    control: row.control,
    claim: row.claim,
    justification: row.justification,
    ...(row.evidencePointer !== undefined
      ? { evidencePointer: row.evidencePointer }
      : {}),
  };
}
