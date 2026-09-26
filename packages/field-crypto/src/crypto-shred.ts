// Crypto-shred (NIST SP 800-88 erasure-by-key-destruction) for stored-DEK field encryption
// (ADR-0055 P2-9, ADR-0052). Reconciles the GDPR/CCPA right-to-erasure with the SEC-17a-4 / HIPAA
// APPEND-ONLY audit chain: a subject's PII cannot be DELETEd from an immutable, hash-chained,
// WORM-anchored record without breaking `verifyChain` — so the chain only ever commits the CIPHERTEXT
// envelope (never plaintext), and erasure REQUESTS KEY DELETION. The deletion receipt distinguishes
// a provider-retained/recoverable key from one proved destroyed or purged. Once destruction completes,
// the ciphertext is permanently unrecoverable while chain payloads remain byte-for-byte unchanged, so
// `verifyChain(entries, anchor)` still passes. Erasure ⟂ immutability.
//
// INVARIANT (TM-F): chained PII MUST be committed as the `encryptField` ciphertext envelope, NEVER as
// plaintext. A plaintext payload would either survive the shred (defeating erasure) or force a chain
// mutation (defeating immutability). The DEK plaintext is transient — never logged, never chained;
// only its KEK-wrapped form is stored, in an APPEND-ONLY store the shred never mutates (destroying the
// KEK suffices, ADR-0014).
//
// SCOPE — this module ORCHESTRATES the shred (schedule the KEK deletion through `KmsKeyProvider`) and
// MINTS the `erasure.crypto-shred` audit payload. APPENDING that payload to the WORM chain and
// emitting the operational `EventSink` event are the Compliance edition's job (down-only: field-crypto
// stays kernel-only, ADR-0043/0003). No live KMS call runs in CI — the KMS is behind the port (TM-G).
import { z } from "zod";
import { parseStrict, strictObject } from "@caisson-sh/kernel";
import type { JsonValue } from "@caisson-sh/kernel";
import type { KmsKeyProvider } from "./kms.ts";
import type { KmsDeletionReceipt } from "./kms-port.ts";

/** The audit event name minted into the WORM chain (and the ops `EventSink`) on a crypto-shred. */
export const ERASURE_CRYPTO_SHRED = "erasure.crypto-shred" as const;

/** How the erasure was effected — recorded in the audit payload for the auditor. */
const SHRED_METHOD = "kms-key-deletion" as const;

/**
 * Boundary schema for an erasure request (`.strict()` — unknown keys rejected, fail-closed). Every
 * field is an OPAQUE identifier or metadata: none may carry the erased PII (it is recorded as the
 * FACT of erasure, then preserved forever in the immutable chain).
 */
const cryptoShredRequestSchema = strictObject({
  /**
   * The KEK scope to destroy — the SAME scope the subject's DEK was provisioned at (a per-SUBJECT key
   * id for GDPR subject erasure; a tenant id for tenant-wide erasure).
   */
  keyScopeId: z.string().min(1).max(256),
  /** Opaque tenant reference for the record — NEVER raw PII. */
  tenantId: z.string().min(1).max(256),
  /** Opaque data-subject reference for the record — NEVER raw PII. */
  subjectId: z.string().min(1).max(256),
  /** Legal basis for the erasure, e.g. "gdpr-art17" / "ccpa-1798.105". */
  reason: z.string().min(1).max(512),
  /** ISO-8601 erasure instant — injected at the edge so the audit payload is deterministic. */
  occurredAt: z.string().datetime(),
}).superRefine((request, ctx) => {
  if (
    request.keyScopeId !== request.tenantId &&
    request.keyScopeId !== request.subjectId
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["keyScopeId"],
      message:
        "keyScopeId must equal the authorized tenantId or subjectId recorded by the erasure request",
    });
  }
});

export type CryptoShredRequest = z.infer<typeof cryptoShredRequestSchema>;

export interface CryptoShredReceipt {
  /** Highest durably provisioned key version covered by the deletion request. */
  readonly shreddedThroughVersion: number;
  /** The exact destruction state the KMS provider proved. */
  readonly deletion: KmsDeletionReceipt;
  /** The `erasure.crypto-shred` audit payload — append to the WORM chain (it carries NO PII). */
  readonly auditPayload: JsonValue;
}

/**
 * Crypto-shred a subject/tenant scope: request deletion of its KEK through the KMS port and mint the
 * provider-proven deletion state into the `erasure.crypto-shred` audit payload for the WORM chain.
 * Fail-closed: a malformed request throws a `ValidationError` BEFORE any deletion is scheduled. The
 * returned payload is metadata-only (ids, reason, instant, versions, method, deletion state) — it
 * commits the FACT and current finality of erasure without ever embedding the erased PII.
 * The host must authorize the tenant/subject before this call and durably reconcile any recoverable
 * provider receipt; this low-level package does not claim request retries are deletion-idempotent.
 */
export async function cryptoShred(
  provider: KmsKeyProvider,
  request: CryptoShredRequest,
): Promise<CryptoShredReceipt> {
  const req = parseStrict(cryptoShredRequestSchema, request);
  const { shreddedThroughVersion, deletion } =
    await provider.scheduleKeyDeletion(req.keyScopeId);
  const auditPayload: JsonValue = {
    event: ERASURE_CRYPTO_SHRED,
    deletion,
    method: SHRED_METHOD,
    tenantId: req.tenantId,
    subjectId: req.subjectId,
    reason: req.reason,
    occurredAt: req.occurredAt,
    shreddedThroughVersion,
  };
  return { shreddedThroughVersion, deletion, auditPayload };
}
