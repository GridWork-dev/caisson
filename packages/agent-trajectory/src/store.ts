// The `TrajectoryStore` port + an in-memory implementation. Append-only is the whole point: a run's
// event log is a monotonic 0-based `seq` sequence with NO gaps and NO rewrites. `append`:
//   - idempotent on `(runId, seq)` — re-appending a byte-identical event at an already-recorded seq
//     is a no-op (safe retry after a dropped ack), so exactly-once callers stay correct;
//   - rejects a REWRITE — a different event at an already-recorded seq throws `ConflictError`;
//   - rejects a GAP — a seq beyond the next expected slot throws `ConflictError`.
//
// The port is the seam the ai-kit gateway and the agent-runner CLI record into (T3/T4). The memory
// impl is for tests + single-process runs; a PG-backed impl mirrors ai-meter's append-only
// `usage_event` table (a `(run_id, seq)` UNIQUE + REVOKE UPDATE, DELETE) — documented in the README,
// not built in slice 1.
import { ConflictError, parseStrict } from "@caisson-sh/kernel";
import { TrajectoryEvent } from "./schema.ts";

export interface TrajectoryStore {
  /** Append one event. Idempotent on `(runId, seq)`; rejects seq gaps and rewrites (append-only). */
  append(event: TrajectoryEvent): Promise<void>;
  /** All events for a run, in seq order (a defensive copy — never the live array). */
  read(runId: string): Promise<TrajectoryEvent[]>;
}

/**
 * In-memory `TrajectoryStore`. One array per run, index == seq. The store validates every event
 * through the strict schema at the boundary (fail-closed) before it is admitted.
 */
export function createMemoryTrajectoryStore(): TrajectoryStore {
  const runs = new Map<string, TrajectoryEvent[]>();

  return {
    async append(event: TrajectoryEvent): Promise<void> {
      const parsed = parseStrict(TrajectoryEvent, event);
      const log = runs.get(parsed.runId) ?? [];
      const expected = log.length; // the next free (0-based) seq slot for this run

      if (parsed.seq === expected) {
        log.push(parsed);
        runs.set(parsed.runId, log);
        return;
      }

      if (parsed.seq < expected) {
        // Already-recorded slot: idempotent iff byte-identical (both sides are schema-parsed, so key
        // order is schema-determined and JSON.stringify is a canonical equality), else a rewrite.
        const existing = log[parsed.seq];
        if (existing !== undefined && stableEqual(existing, parsed)) return;
        throw new ConflictError(
          "append-only: seq already recorded with different content",
          { runId: parsed.runId, seq: parsed.seq },
        );
      }

      // parsed.seq > expected — a gap; append-only forbids skipping a slot.
      throw new ConflictError("append-only: seq gap", {
        runId: parsed.runId,
        seq: parsed.seq,
        expected,
      });
    },

    async read(runId: string): Promise<TrajectoryEvent[]> {
      return [...(runs.get(runId) ?? [])];
    },
  };
}

function stableEqual(a: TrajectoryEvent, b: TrajectoryEvent): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
