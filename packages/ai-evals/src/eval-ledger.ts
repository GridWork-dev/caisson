// @caisson-sh/ai-evals — the budget-isolated eval-spend ledger (ADR-0214). Eval spend is tracked through
// an injected port, mirroring the `Judge` port and `@caisson-sh/kernel` `EventSink` — NEVER through
// `@caisson-sh/ai-meter` (production budget) or a Postgres dependency. This module imports nothing from
// `@caisson-sh/ai-meter`; isolation is by construction, not convention (grep-checkable, asserted below).
import { z } from "zod";
import { systemClock, type Clock } from "./clock.ts";

/** One recorded eval run's spend. `.strict()`; `costCents` is integer money (ADR-0007). */
export const evalSpendEntrySchema = z
  .object({
    id: z.string().uuid(),
    evalName: z.string().min(1).max(200),
    ranAt: z.string().datetime(),
    cases: z.number().int().nonnegative(),
    costCents: z.number().int().nonnegative(),
  })
  .strict();
export type EvalSpendEntry = z.infer<typeof evalSpendEntrySchema>;

/** The ledger port. `InMemoryEvalLedgerSink` backs tests/local dev; a caller injects any other sink. */
export interface EvalLedgerSink {
  record(entry: EvalSpendEntry): void | Promise<void>;
}

/** In-memory sink for tests + local development. */
export class InMemoryEvalLedgerSink implements EvalLedgerSink {
  readonly #entries: EvalSpendEntry[] = [];
  record(entry: EvalSpendEntry): void {
    this.#entries.push(entry);
  }
  get entries(): readonly EvalSpendEntry[] {
    return this.#entries;
  }
  clear(): void {
    this.#entries.length = 0;
  }
}

export interface RecordEvalSpendArgs {
  readonly evalName: string;
  readonly cases: number;
  readonly costCents: number;
  /** The point-in-time reader stamped onto `ranAt` (ADR-0214). Defaults to `systemClock`. */
  readonly clock?: Clock;
}

/**
 * Stamp `id`/`ranAt`, validate, and record one eval run's spend into `sink`. Fail-closed: a
 * non-integer or negative `costCents`/`cases` throws at the schema boundary rather than silently
 * rounding or clamping. `ranAt` reads `args.clock` (default `systemClock`), never `Date.now()`
 * directly — a backtest replays this same function with a fixed/sequenced clock injected.
 */
export async function recordEvalSpend(
  sink: EvalLedgerSink,
  args: RecordEvalSpendArgs,
): Promise<EvalSpendEntry> {
  const clock = args.clock ?? systemClock;
  const entry = evalSpendEntrySchema.parse({
    id: crypto.randomUUID(),
    evalName: args.evalName,
    ranAt: clock.now().toISOString(),
    cases: args.cases,
    costCents: args.costCents,
  });
  await sink.record(entry);
  return entry;
}
