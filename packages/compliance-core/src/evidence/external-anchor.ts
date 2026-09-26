// src/evidence/external-anchor.ts — the DETACHED external-anchor attachment for evidence packs (T7;
// SPEC external-anchoring Design §6, ADR-0332/0346).
//
// MINIMAL seam (a parallel lane owns the pack-format bump): the newest external-anchor receipt is
// attached to a generated pack as a DETACHED archive entry + a grade tag on the RESULT ENVELOPE —
// NEVER a field in the canonical `manifest.json` body. The receipt carries a non-deterministic TSA
// token; hashing it into the signed body would break the generator's byte-stability (ADR-0058, the
// same reason the signature and `generatedAt` sit on the envelope, not in the body).
//
// Kept dependency-free of @caisson-sh/audit-worm (compliance-core does not depend on it): only the two
// grade literals are load-bearing here; the receipt is embedded verbatim as evidence, already
// validated by audit-worm on the WORM write.
import { z } from "zod";
import { canonicalize, parseStrict, type JsonValue } from "@caisson-sh/kernel";

/** The two honestly-distinct trust grades (mirrors @caisson-sh/audit-worm's `AnchorGrade`). */
export const anchorGradeSchema = z.enum([
  "trusted-timestamped",
  "externally-transparent",
]);
export type AnchorGrade = z.infer<typeof anchorGradeSchema>;

/**
 * The detached external-anchor attachment a generated pack may carry. `receipt` is the full
 * `AnchorReceipt` JSON, embedded verbatim as evidence; only `grade` drives the honest envelope tag +
 * auditor-summary phrase.
 */
export interface ExternalAnchorAttachment {
  readonly grade: AnchorGrade;
  readonly receipt: JsonValue;
}

/** The fixed archive-entry name for the detached receipt. */
export const EXTERNAL_ANCHOR_RECEIPT_ENTRY = "external-anchor-receipt.json";

/**
 * The HONEST auditor-summary phrase for a grade. `trusted-timestamped` is a PRIVATE receipt and is
 * NEVER described as "externally verifiable" / "outside parties detect rewrite" (ADR-0332 Binding) —
 * that claim attaches only to the public-log `externally-transparent` grade (v1.1).
 */
export function anchorGradePhrase(grade: AnchorGrade): string {
  switch (grade) {
    case "trusted-timestamped":
      return (
        "External anchoring: a private, third-party-clock-attested receipt (RFC-3161 TSA). It " +
        "attests this chain checkpoint existed at the receipt time; it is not a public-transparency proof."
      );
    case "externally-transparent":
      return (
        "External anchoring: a public transparency-log receipt. This chain checkpoint is provable " +
        "to a party holding none of your data."
      );
  }
}

/**
 * Validate + build the detached receipt archive entry (canonical JSON bytes). Fails closed on a grade
 * outside the two-literal enum. Returns the entry plus the validated grade for the envelope tag.
 */
export function buildExternalAnchorEntry(
  attachment: ExternalAnchorAttachment,
): {
  readonly name: string;
  readonly data: Uint8Array;
  readonly grade: AnchorGrade;
} {
  const grade = parseStrict(anchorGradeSchema, attachment.grade);
  const data = new TextEncoder().encode(canonicalize(attachment.receipt));
  return { name: EXTERNAL_ANCHOR_RECEIPT_ENTRY, data, grade };
}
