// Deterministic client-side mirror of @caisson/retention-runner's `runErasure` (ADR-0135, ADR-0152)
// for the "retention-runner" poke (ADR-0378 lock 2, kimi CANDIDATES §B "Guard & gate" row). Every
// export below is a faithful, standalone port of the package's fan-out/isolation/audit-row logic —
// nothing here fetches, persists, measures, or uses Date.now/Math.random in a rendered-output path
// (the caller injects `now`, exactly like the real function's own signature).
//
// Why mirrored instead of imported: `run-erasure.ts` and `types.ts` both import `parseStrict` /
// `strictObject` from the bare specifier "@caisson/kernel", which resolves to kernel's package.json
// "exports" "." condition — the full barrel `src/index.ts`. That barrel re-exports `audit-chain.ts`
// and `migration-assembly.ts` (both `node:crypto`) and `ssrf.ts` (`node:dns/promises`), none of which
// resolve in a browser bundle, and kernel exposes no narrower subpath for `schema.ts`. `targets.ts`
// and `audit-sink.ts` happen to have zero *runtime* kernel imports of their own, but the erasure
// primitive is mirrored as one faithful unit (matching `guardrails-logic.ts`'s identical reasoning)
// rather than splitting the client bundle across a real cross-package relative import (unprecedented
// in this app) and a partial mirror. Parity is golden-pinned in `retention-runner-logic.test.ts`
// against the real package, imported by relative path under bun (apps/site does not declare
// @caisson/retention-runner as a dependency) — no `__golden__` fixture dir exists for this package,
// so parity runs directly against the real exported functions on shared sample inputs.
//
// One deliberate omission: the real `runErasure` first runs the request through `parseStrict` /
// `erasureRequestSchema` (an unknown field or an unrecognized `reason` throws `ValidationError`
// before any target runs). This poke's UI can only ever produce a well-formed request (the reason
// comes from a closed radio group, the subject/tenant ids are fixed sample strings), so that
// validation leg is never exercised and is left out here rather than faked.

// ---- Request + result shapes (packages/retention-runner/src/types.ts) --------------------------

/**
 * Verbatim: types.ts `ERASURE_REASONS`. `auto_90d` is the recurring scheduled sweep; `ccpa_request`
 * and `operator_manual` are one-shot, subject/operator-triggered calls straight into `runErasure`.
 */
export const ERASURE_REASONS = [
  "auto_90d",
  "ccpa_request",
  "operator_manual",
] as const;
export type ErasureReason = (typeof ERASURE_REASONS)[number];

export interface ErasureRequest {
  readonly subjectId: string;
  readonly tenantId: string;
  readonly reason: ErasureReason;
}

/** Verbatim shape: types.ts `TargetResult`. `error` is present only when `ok` is `false` (its
 * message, never a stack). */
export interface TargetResult {
  readonly target: string;
  readonly ok: boolean;
  readonly error?: string;
}

/** Verbatim shape: types.ts `RetentionRunResult` — one `runErasure` run, written as one audit row. */
export interface RetentionRunResult {
  readonly subjectId: string;
  readonly tenantId: string;
  readonly reason: ErasureReason;
  readonly results: TargetResult[];
  readonly at: number;
}

// ---- Targets (packages/retention-runner/src/targets.ts) ----------------------------------------

/** Verbatim: targets.ts `ErasureTarget` port — erase one subject's data, or throw. */
export interface ErasureTarget {
  readonly name: string;
  erase(subjectId: string, tenantId: string): Promise<void>;
}

/** The three reference driver names — verbatim hardcoded strings in targets.ts's
 * `createObjectStorageTarget` / `createCascadeDbTarget` / `createOrphanSweepTarget`. */
export const REFERENCE_TARGET_NAMES = [
  "object-storage-purge",
  "cascade-db-delete",
  "orphan-record-sweep",
] as const;
export type ReferenceTargetName = (typeof REFERENCE_TARGET_NAMES)[number];

/**
 * A sample target driver: one of the three reference names, optionally forced to fail — the
 * poke's break-it control. Mirrors run-erasure.test.ts's own `createFailingTarget` test helper
 * (a target whose `erase` rejects) alongside targets.ts's real reference-target shape.
 */
export function createSampleTarget(
  name: ReferenceTargetName,
  fail: boolean,
): ErasureTarget {
  return {
    name,
    async erase(): Promise<void> {
      if (fail) throw new Error(`${name}: store unreachable`);
    },
  };
}

// ---- Audit sink (packages/retention-runner/src/audit-sink.ts) ----------------------------------

/** Verbatim: audit-sink.ts `RetentionAuditSink` port — one method, records one run's outcome. */
export interface RetentionAuditSink {
  record(row: RetentionRunResult): Promise<void>;
}

export interface CaptureAuditSink extends RetentionAuditSink {
  readonly rows: readonly RetentionRunResult[];
}

/** Verbatim: audit-sink.ts `createCaptureAuditSink` — in-memory sink, never touches a store. */
export function createCaptureAuditSink(): CaptureAuditSink {
  const rows: RetentionRunResult[] = [];
  return {
    async record(row: RetentionRunResult): Promise<void> {
      rows.push(row);
    },
    get rows(): readonly RetentionRunResult[] {
      return rows;
    },
  };
}

// ---- The runner (packages/retention-runner/src/run-erasure.ts) ---------------------------------

/** Verbatim: run-erasure.ts's private `eraseOne` — catches any throw into a `TargetResult` rather
 * than propagating it, so one failing target never aborts the run or the others. */
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
 * Verbatim algorithm: run-erasure.ts `runErasure`, minus the `parseStrict` request-validation leg
 * (see this file's header). Runs every target (`Promise.all` over the try/catching `eraseOne`, so
 * one throw never aborts the others), writes exactly ONE reason-tagged row via `sink.record`, and
 * returns that row. `now` is injected — never called inline — exactly like the real signature's
 * `now: () => number = Date.now` default (this mirror requires the caller supply it, so a rendered
 * path can never reach for the real clock).
 */
export async function runErasure(
  request: ErasureRequest,
  targets: readonly ErasureTarget[],
  sink: RetentionAuditSink,
  now: () => number,
): Promise<RetentionRunResult> {
  const results = await Promise.all(
    targets.map((target) =>
      eraseOne(target, request.subjectId, request.tenantId),
    ),
  );
  const row: RetentionRunResult = {
    subjectId: request.subjectId,
    tenantId: request.tenantId,
    reason: request.reason,
    results,
    at: now(),
  };
  await sink.record(row);
  return row;
}

// ---- The field-crypto cross-reference (packages/field-crypto/src/crypto-shred.ts) --------------

/**
 * Verbatim string constant: crypto-shred.ts `ERASURE_CRYPTO_SHRED` — the audit event name minted
 * into the WORM chain (and the ops `EventSink`) when field-encrypted PII is erased by destroying
 * its KEK, not by a target delete. Cited here for context only: retention-runner's targets never
 * call `cryptoShred` (field-crypto stays kernel-only — ADR-0043/0003; wiring the two together is
 * the Compliance edition's job), so this poke never runs it, only cites the real constant.
 */
export const ERASURE_CRYPTO_SHRED = "erasure.crypto-shred" as const;
