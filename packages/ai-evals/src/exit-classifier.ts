// @caisson-sh/ai-evals — the exit classifier (ADR-0214). WHY a run exited, not whether it scored well:
// a grader annotation orthogonal to pass/fail. Pure + deterministic, no I/O, no model call — a
// priority chain over a caller-supplied signal (the caller already knows if it errored/timed out/hit
// its budget; this module never infers those from prose).
import { z } from "zod";

/** The exit taxonomy. Every run exits as exactly one of these, chosen by priority (see below). */
export const EXIT_CLASSES = [
  "success",
  "error",
  "timeout",
  "refusal",
  "budget-exhausted",
  "empty-output",
  "unknown",
] as const;
export type ExitClass = (typeof EXIT_CLASSES)[number];

/** What the caller observed about one run. `.strict()` — unknown fields rejected at the boundary. */
export const exitSignalSchema = z
  .object({
    output: z.string().optional(),
    errored: z.boolean().optional(),
    timedOut: z.boolean().optional(),
    budgetExhausted: z.boolean().optional(),
    /** Substrings (case-insensitive) that mark `output` as a refusal, e.g. "I can't help with that". */
    refusalMarkers: z.array(z.string().min(1)).optional(),
  })
  .strict();
export type ExitSignal = z.infer<typeof exitSignalSchema>;

/**
 * Classify why a run exited. Priority chain (first match wins), matching the SPEC exactly:
 *   error → timeout → budget-exhausted → refusal → empty-output → success → unknown.
 * `refusal` only fires when `output` is present and contains a marker substring. `empty-output`
 * fires on an explicit empty string; a completely absent `output` with no other signal is `unknown`
 * — there's nothing to distinguish "produced nothing" from "we never captured it".
 */
export function classifyExit(signal: ExitSignal): ExitClass {
  if (signal.errored === true) return "error";
  if (signal.timedOut === true) return "timeout";
  if (signal.budgetExhausted === true) return "budget-exhausted";

  if (signal.output !== undefined && signal.refusalMarkers !== undefined) {
    const hay = signal.output.toLowerCase();
    const isRefusal = signal.refusalMarkers.some((marker) =>
      hay.includes(marker.toLowerCase()),
    );
    if (isRefusal) return "refusal";
  }

  if (signal.output === "") return "empty-output";
  if (signal.output !== undefined) return "success";
  return "unknown";
}
