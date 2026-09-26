// @caisson-sh/retention-runner — the `RetentionAuditSink` port (ADR-0135, ADR-0152). Plain
// audit-LOGGING, explicitly NOT WORM/hash-chained (see ADR-0135 Genericness) — `runErasure` writes
// exactly one reason-tagged row per run. The real pg driver is a documented seam (`src/migrations/`
// ships the table); this file ships only the in-memory driver for tests + the framework-agnostic
// reference, mirroring `@caisson-sh/email`'s capture-driver shape.
import type { RetentionRunResult } from "./types.ts";

/** The port: one method, records one run's outcome. */
export interface RetentionAuditSink {
  record(row: RetentionRunResult): Promise<void>;
}

/** A test driver that records every audit row in memory for assertions. */
export interface CaptureAuditSink extends RetentionAuditSink {
  readonly rows: readonly RetentionRunResult[];
}

/** In-memory `RetentionAuditSink` for tests + the framework-agnostic reference. */
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
