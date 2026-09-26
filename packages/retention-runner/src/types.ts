// @caisson-sh/retention-runner — request/result types (ADR-0135, ADR-0152). The erasure boundary is
// the ONE Zod `.strict()` entry point (`erasureRequestSchema`); `TargetResult`/`RetentionRunResult`
// are plain data shapes produced by `runErasure` and consumed by the audit sink.
import { strictObject } from "@caisson-sh/kernel";
import { z } from "zod";

/**
 * The three erasure triggers. `auto_90d` is the recurring scheduled sweep; `ccpa_request`
 * and `operator_manual` are one-shot, operator/subject-triggered calls straight into `runErasure`.
 * Closed enum — an unrecognized reason fails strict parsing rather than silently tagging the row.
 */
export const ERASURE_REASONS = [
  "auto_90d",
  "ccpa_request",
  "operator_manual",
] as const;

/** Zod enum over {@link ERASURE_REASONS}. */
export const erasureReasonSchema = z.enum(ERASURE_REASONS);

export type ErasureReason = z.infer<typeof erasureReasonSchema>;

/**
 * The erasure request. `.strict()` — an unknown field fails closed rather than being silently
 * dropped. `subjectId`/`tenantId` are opaque caller-supplied identifiers (no shape assumed here).
 */
export const erasureRequestSchema = strictObject({
  subjectId: z.string().min(1),
  tenantId: z.string().min(1),
  reason: erasureReasonSchema,
});

export type ErasureRequest = z.infer<typeof erasureRequestSchema>;

/** One target's outcome. `error` is present only when `ok` is `false` (its message, never a stack). */
export interface TargetResult {
  target: string;
  ok: boolean;
  error?: string;
}

/** One `runErasure` run: every target's outcome plus the reason tag, written as one audit row. */
export interface RetentionRunResult {
  subjectId: string;
  tenantId: string;
  reason: ErasureReason;
  results: TargetResult[];
  at: number;
}
