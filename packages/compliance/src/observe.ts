// Operational telemetry for the Compliance edition (ADR-0075). Emits the OPS mirror of two
// compliance actions — evidence-pack generation and crypto-shred erasure — through the base
// `EventSink` port. These are mutable, drop-able operational events on the OTel→Postgres spine; they
// are NOT the evidentiary record. The authoritative, immutable record of an evidence pack / erasure
// lives in the WORM audit chain (`@caisson-sh/audit-worm`), which is NEVER routed through this sink —
// the kernel keeps the two write paths strictly separate (event-sink invariant 2). This boundary
// carries only OPAQUE ids + posture counts + a content digest — never PII, ciphertext, or a secret;
// the kernel sink redacts once more at the edge as a belt (ADR-0019). The clock is injected at the
// edge (the caller passes the ISO-8601 instant) so emitted timestamps are deterministic + testable.
import type { EventSink, OpsEvent } from "@caisson-sh/kernel";
import {
  ERASURE_CRYPTO_SHRED,
  type KmsDeletionReceipt,
} from "@caisson-sh/field-crypto";

// Single-source the erasure event name from `@caisson-sh/field-crypto` (the same name minted into the
// WORM chain) so the operational mirror can never drift from the evidentiary record.
export { ERASURE_CRYPTO_SHRED };

/** Ops event name emitted once a deterministic evidence pack has been generated. */
export const EVIDENCE_GENERATED = "evidence.generated" as const;

/**
 * Operational summary of a generated evidence pack — opaque ids + posture counts + the pack's content
 * address only. NO control body, NO PII. `flaggedCount` is posture (a gap/POA&M signal), never a
 * "compliant/certified" claim (ADR-0058 readiness-copy discipline).
 */
export interface EvidenceGeneratedEvent {
  /** Owning tenant (opaque reference). */
  readonly tenantId: string;
  /** Framework slug the pack was generated for, e.g. `"soc2-tsc"`. */
  readonly framework: string;
  /** Lowercase-hex SHA-256 of the deterministic archive — the pack's content address. */
  readonly sha256: string;
  /** Total controls in the pack. */
  readonly controlCount: number;
  /** Controls whose evidence is flagged (a gap/POA&M item) — posture, never an attestation. */
  readonly flaggedCount: number;
  /** ISO-8601 generation instant — injected at the edge (clock at the edge). */
  readonly generatedAt: string;
}

/**
 * Operational summary of a crypto-shred request — opaque ids + the legal basis + the highest key
 * version covered. NEVER raw PII (the FACT and provider-reported finality are preserved forever in
 * the immutable chain; this is only its drop-able ops mirror).
 */
export interface ErasureCryptoShredEvent {
  /** Owning tenant (opaque reference). */
  readonly tenantId: string;
  /** Opaque data-subject reference — never raw PII. */
  readonly subjectId: string;
  /** Legal basis recorded for the erasure, e.g. `"gdpr-art17"`. */
  readonly reason: string;
  /** Highest key version covered by the deletion request (0 if the scope was never provisioned). */
  readonly shreddedThroughVersion: number;
  /** Exact provider-proven deletion state; pending/recoverable states stay explicit. */
  readonly deletion: KmsDeletionReceipt;
  /** ISO-8601 erasure instant — injected at the edge. */
  readonly occurredAt: string;
}

/**
 * Emit the `evidence.generated` operational event. Awaits the sink so a Promise-returning transport
 * (OTel→Postgres) is flushed before the call resolves; a synchronous transport resolves immediately.
 */
export async function emitEvidenceGenerated(
  sink: EventSink,
  event: EvidenceGeneratedEvent,
): Promise<void> {
  const ops: OpsEvent = {
    name: EVIDENCE_GENERATED,
    timestamp: event.generatedAt,
    tenantId: event.tenantId,
    attributes: {
      framework: event.framework,
      sha256: event.sha256,
      controlCount: event.controlCount,
      flaggedCount: event.flaggedCount,
    },
  };
  await sink.emit(ops);
}

/**
 * Emit the `erasure.crypto-shred` operational event. The evidentiary record of the erasure stays in
 * the WORM audit chain (ADR-0052/0055); this is its mutable ops mirror only.
 */
export async function emitErasureCryptoShred(
  sink: EventSink,
  event: ErasureCryptoShredEvent,
): Promise<void> {
  const ops: OpsEvent = {
    name: ERASURE_CRYPTO_SHRED,
    timestamp: event.occurredAt,
    tenantId: event.tenantId,
    attributes: {
      subjectId: event.subjectId,
      reason: event.reason,
      shreddedThroughVersion: event.shreddedThroughVersion,
      deletion: event.deletion,
    },
  };
  await sink.emit(ops);
}
