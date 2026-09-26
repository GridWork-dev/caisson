// Stage 5 of the alerting pipeline (ADR-0135): a structured, PLAIN audit-logging row — explicitly
// NOT hash-chained WORM (see ADR-0135 "Genericness"; do not import @caisson-sh/audit-worm here). The
// Postgres shape lives in `src/migrations/0001_alert_audit.sql`; this file ships the port + the
// in-memory driver (the `@caisson-sh/jobs` in-memory-queue idiom: real assertions, no daemon).
import type { AlertSeverity } from "./types.ts";
import type { DeliveryResult } from "./delivery.ts";

export type AlertOutcome = "delivered" | "suppressed" | "held" | "digested";

export interface AlertAuditRow {
  eventId: string;
  type: string;
  severity: AlertSeverity;
  tenantId: string;
  recipient: string;
  outcome: AlertOutcome;
  channels: readonly DeliveryResult[];
  /** Epoch ms. */
  at: number;
}

export interface AlertAuditSink {
  record(row: AlertAuditRow): Promise<void>;
}

/** A test driver that records every audit row in memory; never touches the network/DB. */
export interface CaptureAuditSink extends AlertAuditSink {
  readonly rows: readonly AlertAuditRow[];
}

export function createInMemoryAuditSink(): CaptureAuditSink {
  const rows: AlertAuditRow[] = [];
  return {
    async record(row: AlertAuditRow): Promise<void> {
      rows.push(row);
    },
    get rows(): readonly AlertAuditRow[] {
      return rows;
    },
  };
}
