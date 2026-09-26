// src/evidence/drift/deviation.ts — accepted-deviation state for the drift monitor (ADR-0371, SPEC
// item 4).
//
// A typed, first-class record: an adopter accepts a KNOWN gap for one control, naming who accepted it,
// why, and when it expires. Flag-never-guess (the binding `collector.ts` already enforces, extended
// here): the deviation NEVER flips a flagged evidence item to pass — the generated pack and the
// snapshot still show the gap honestly. It only suppresses the drift-regression ALERT, and only for
// the EXACT flagged reasons it was accepted against (the "baseline", captured automatically from the
// snapshot at acceptance — derived, never hand-asserted, same discipline `pack-format.ts` uses for
// readiness). A NEW or DIFFERENT flagged reason on the same control is a regression past what was
// accepted, and re-arms alerting even before expiry.
import { z } from "zod";
import { strictObject, parseStrict } from "@caisson-sh/kernel";
import type { ComplianceSnapshot } from "./types.ts";
import type { ControlStatusTransition } from "./diff.ts";

export const acceptedDeviationSchema = strictObject({
  id: z.string().trim().min(1).max(200),
  controlId: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(2000),
  acceptor: z.string().trim().min(1).max(200),
  /** ISO-8601; the deviation stops suppressing alerts at/after this instant. */
  expiresAt: z.string().datetime(),
  /**
   * `collectorId -> the flagged reason accepted for it`, captured from the snapshot at acceptance
   * time (see `acceptDeviation`). A control may carry more than one flagged evidence item; every one
   * present at acceptance is in the baseline.
   */
  baseline: z.record(
    z.string().trim().min(1).max(200),
    z.string().trim().min(1).max(2000),
  ),
});
export type AcceptedDeviation = z.infer<typeof acceptedDeviationSchema>;

/**
 * Build an accepted deviation, DERIVING `baseline` from the current `snapshot`'s flagged rows for
 * `controlId` — never hand-supplied, so a deviation can't be minted against a gap that doesn't
 * actually exist. When the control has no flagged evidence at acceptance time, `baseline` is
 * legitimately empty — this is NOT rejected: it is a valid, inert deviation. An empty baseline
 * matches nothing, so `isTransitionSuppressed` always returns `false` for it (there is nothing to
 * suppress against); it only becomes load-bearing once a matching flagged reason is accepted.
 */
export function acceptDeviation(input: {
  readonly id: string;
  readonly controlId: string;
  readonly reason: string;
  readonly acceptor: string;
  readonly expiresAt: string;
  readonly snapshot: ComplianceSnapshot;
}): AcceptedDeviation {
  const baseline: Record<string, string> = {};
  for (const row of input.snapshot) {
    if (
      row.controlId === input.controlId &&
      row.status === "flagged" &&
      row.reason !== undefined
    ) {
      baseline[row.collectorId] = row.reason;
    }
  }
  return parseStrict(acceptedDeviationSchema, {
    id: input.id,
    controlId: input.controlId,
    reason: input.reason,
    acceptor: input.acceptor,
    expiresAt: input.expiresAt,
    baseline,
  });
}

/**
 * Whether `transition` should be suppressed by `deviation` at instant `now`. Never suppresses a
 * transition landing on anything but `flagged` (nothing to suppress) — and only suppresses when: the
 * deviation targets the same control, has not expired, and the flagged reason for THIS collector
 * matches EXACTLY what was accepted at baseline. An unmatched or absent baseline entry — a new
 * collector flagging, or the same collector flagging for a different reason — is a regression past
 * what was accepted, so this returns `false` and the alert fires despite the (still-active) deviation.
 */
export function isTransitionSuppressed(
  transition: ControlStatusTransition,
  deviation: AcceptedDeviation | undefined,
  now: Date,
): boolean {
  if (deviation === undefined) return false;
  if (transition.to !== "flagged") return false;
  if (deviation.controlId !== transition.controlId) return false;
  if (new Date(deviation.expiresAt).getTime() <= now.getTime()) return false;
  const accepted = deviation.baseline[transition.collectorId];
  if (accepted === undefined) return false;
  return accepted === transition.toReason;
}
