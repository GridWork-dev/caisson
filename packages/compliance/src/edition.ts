// The composed Compliance edition (ADR-0178, mirroring ADR-0199). ADR-0178 folds two
// operational-compliance primitives into the Compliance bundle: SOC2 CC7.2 alerting
// (@caisson/alerting) and CCPA/GDPR right-to-erasure (@caisson/retention-runner). Like ADR-0199 did
// for @caisson/tool-exec in the Agentic-Dev edition, a manifest that DECLARES these members must also
// DELIVER them: this factory wires both into ONE reachable edition surface so a buyer gets the bundled
// gates from the edition, not merely a members-map claim. The evidence/WORM/crypto surface stays the
// barrel exports (src/index.ts); this composes only the two bundled primitives.
//
// Down-only (ADR-0003): the edition composes primitives; neither primitive depends back on the
// edition, so no cycle. Construction holds NO credential and makes NO network call — channels/targets
// are injected and fire only on `process`/`run`; each pipeline defaults to an in-memory audit sink so
// a run never silently drops its audit row.
import {
  createInMemoryAuditSink,
  processAlert,
  type AlertAuditSink,
  type AlertChannel,
  type AlertEvent,
  type ProcessAlertDeps,
  type ProcessAlertResult,
} from "@caisson/alerting";
import {
  createCaptureAuditSink,
  runErasure,
  type ErasureRequest,
  type ErasureTarget,
  type RetentionAuditSink,
  type RetentionRunResult,
} from "@caisson/retention-runner";

/** Construction options for the composed Compliance edition. Both blocks are optional; an omitted
 *  block yields a safe default (no channels/targets + an in-memory audit sink). */
export interface ComplianceEditionOptions {
  /** SOC2 CC7.2 alerting composition (@caisson/alerting). */
  readonly alerting?: {
    /** Delivery channels (email/webhook/Slack/Telegram/capture). Omit ⇒ no channels (audit-only). */
    readonly channels?: readonly AlertChannel[];
    /** Audit sink. Omit ⇒ an in-memory capture sink so no audit row is dropped. */
    readonly auditSink?: AlertAuditSink;
  };
  /** CCPA/GDPR right-to-erasure composition (@caisson/retention-runner). */
  readonly retention?: {
    /** Erasure targets (object-storage/cascade-db/orphan-sweep/capture). Omit ⇒ no targets. */
    readonly targets?: readonly ErasureTarget[];
    /** Audit sink. Omit ⇒ an in-memory capture sink so no audit row is dropped. */
    readonly auditSink?: RetentionAuditSink;
  };
}

/** The composed edition's bundled operational-compliance gates (ADR-0178), each bound to its
 *  composition-time channels/targets + audit sink. Per-event runtime signals are supplied per call. */
export interface ComplianceEdition {
  /** SOC2 CC7.2 alerting gate bound to the composed channels + audit sink (@caisson/alerting). */
  readonly alerting: {
    readonly channels: readonly AlertChannel[];
    readonly auditSink: AlertAuditSink;
    /** Run the five-stage alerting pipeline for one event (per-event signals passed as `runtime`). */
    process(
      event: AlertEvent,
      runtime: Omit<ProcessAlertDeps, "channels" | "auditSink">,
    ): Promise<ProcessAlertResult>;
  };
  /** CCPA/GDPR erasure runner bound to the composed targets + audit sink (@caisson/retention-runner). */
  readonly retention: {
    readonly targets: readonly ErasureTarget[];
    readonly auditSink: RetentionAuditSink;
    /** Erase one subject across every composed target, writing one reason-tagged audit row. */
    run(
      request: ErasureRequest,
      now?: () => number,
    ): Promise<RetentionRunResult>;
  };
}

/** Compose the Compliance edition's bundled operational primitives into one reachable surface
 *  (ADR-0178, mirroring ADR-0199). See the file header for the down-only + no-credential invariants. */
export function createComplianceEdition(
  options: ComplianceEditionOptions = {},
): ComplianceEdition {
  const alertChannels = options.alerting?.channels ?? [];
  const alertAuditSink =
    options.alerting?.auditSink ?? createInMemoryAuditSink();
  const erasureTargets = options.retention?.targets ?? [];
  const retentionAuditSink =
    options.retention?.auditSink ?? createCaptureAuditSink();

  return {
    alerting: {
      channels: alertChannels,
      auditSink: alertAuditSink,
      process: (event, runtime) =>
        processAlert(event, {
          ...runtime,
          channels: alertChannels,
          auditSink: alertAuditSink,
        }),
    },
    retention: {
      targets: erasureTargets,
      auditSink: retentionAuditSink,
      // runErasure takes a mutable array + a defaulted clock; spread to a fresh array and only pass
      // `now` when supplied so its `Date.now` default applies on omission (exactOptional-safe).
      run: (request, now) =>
        now === undefined
          ? runErasure(request, [...erasureTargets], retentionAuditSink)
          : runErasure(request, [...erasureTargets], retentionAuditSink, now),
    },
  };
}
