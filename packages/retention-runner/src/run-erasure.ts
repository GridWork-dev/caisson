// @caisson-sh/retention-runner — `runErasure` (ADR-0135, ADR-0152). Runs every registered
// `ErasureTarget` with PER-TARGET ERROR ISOLATION: one failing store never aborts the run or the
// others (the `Promise.allSettled` shape ADR-0152 locks — each target's own throw is caught and
// recorded, not propagated), then writes exactly one reason-tagged audit row via the injected sink.
import { parseStrict } from "@caisson-sh/kernel";
import type { ErasureTarget } from "./targets.ts";
import type { RetentionAuditSink } from "./audit-sink.ts";
import { erasureRequestSchema } from "./types.ts";
import type {
  ErasureRequest,
  RetentionRunResult,
  TargetResult,
} from "./types.ts";

/** Erase one target, catching any throw into a `TargetResult` rather than propagating it. */
async function eraseOne(
  target: ErasureTarget,
  subjectId: string,
  tenantId: string,
): Promise<TargetResult> {
  try {
    await target.erase(subjectId, tenantId);
    return { target: target.name, ok: true };
  } catch (err) {
    return {
      target: target.name,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Run `request` against every `target`, then write one audit row via `sink`. `now` is injected
 * (defaults to the real clock) so the run is deterministically testable — never call `Date.now()`
 * inline. The request is validated with `parseStrict` — an unknown field or bad `reason` throws
 * `ValidationError` before any target runs.
 */
export async function runErasure(
  request: ErasureRequest,
  targets: ErasureTarget[],
  sink: RetentionAuditSink,
  now: () => number = Date.now,
): Promise<RetentionRunResult> {
  const { subjectId, tenantId, reason } = parseStrict(
    erasureRequestSchema,
    request,
  );

  const results = await Promise.all(
    targets.map((target) => eraseOne(target, subjectId, tenantId)),
  );

  const row: RetentionRunResult = {
    subjectId,
    tenantId,
    reason,
    results,
    at: now(),
  };
  await sink.record(row);
  return row;
}
