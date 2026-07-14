// The pure request/response contract + proof-assembly transform for the admin proof-bundle endpoint
// (T-A1, per-row verification SPEC). Kept OUT of the route handler so the security-critical bits —
// server-side redaction (H3), the receipt shape (L2: no WORM key), and the strict I/O schemas — are
// unit-testable without a PGlite/WORM/auth harness. The route wires auth + rate-limit + access-log +
// the WORM read around this.
//
// Trust boundary (H1): this is the OPERATOR surface — the target account is a validated UUID input,
// because operator cross-tenant inspection is the design. "Session-derived, RLS-scoped account" is the
// SEPARATE tenant route (GATE-2), not this one.
import { z } from "zod";
import {
  buildRowReceipt,
  verifyEntryAgainstAnchor,
  type RowReceipt,
} from "@caisson/kernel/audit-verify";
import {
  DEFAULT_REDACT_KEYS,
  isRedactedKey,
  redactValue,
} from "@caisson/kernel/redact";
import type { AuditChainEntry, JsonValue } from "@caisson/kernel";
import type { RowProof } from "@caisson/audit-worm";

/**
 * The strict query contract (binding #6, CR-07 §5). `account` is a validated UUID (H1 — the operator
 * inspects a target tenant by id); `seq` is coerced from the query string to a NON-NEGATIVE INTEGER
 * before it can reach WORM-key construction (a float/`"abc"`/negative is a 400). Unknown query fields
 * are rejected by `.strict()`.
 */
export const AuditProofQuery = z
  .object({
    account: z.string().uuid(),
    seq: z.coerce.number().int().nonnegative(),
  })
  .strict();

/** The receipt schema, mirrored strict for the outgoing validation. `raw.payload` is arbitrary JSON. */
const rowReceiptSchema = z
  .object({
    v: z.number().int(),
    seq: z.number().int().nonnegative(),
    hash: z.string().min(1),
    prevHash: z.string().min(1).nullable(),
    // `sig`/`keyId`/`genesisHash` are ADDITIVE public provenance (GATE-1): the client needs `sig` to
    // run its own signature leg against a PINNED, out-of-band key. Never the internal WORM `key` (L2).
    anchor: z
      .object({
        length: z.number().int().nonnegative(),
        tipHash: z.string().min(1),
        genesisHash: z.string().min(1).optional(),
        sig: z.string().min(1).optional(),
        keyId: z.string().min(1).optional(),
      })
      .strict(),
    raw: z
      .object({ prevHash: z.string().min(1).nullable(), payload: z.unknown() })
      .strict(),
    redacted: z.boolean(),
    checks: z
      .object({
        linkRecompute: z.enum(["pass", "fail", "na"]),
        anchorEquality: z.enum(["pass", "fail"]),
        // Display-only (M3): the server's own signature leg. The CLIENT re-runs it against its pinned
        // key and drives the chip/seal from that — never from this field.
        signature: z.enum(["pass", "fail", "na"]).optional(),
      })
      .strict(),
    verifiedAt: z.string().min(1),
  })
  .strict();

/** The success body — a per-row proof bundle the client re-verifies locally (never trusts). */
export const ProofSuccessSchema = z
  .object({
    receipt: rowReceiptSchema,
    redacted: z.boolean(),
    redactedPaths: z.array(z.string()).optional(),
    chainLength: z.number().int().nonnegative(),
  })
  .strict();

/** The fail-closed body (binding #6): a missing/unreadable anchor, never a fabricated pass. */
export const ProofUnverifiableSchema = z
  .object({ state: z.literal("unverifiable"), reason: z.string().min(1) })
  .strict();

/** The full response contract — the route strict-parses its outgoing body against this (strict OUT). */
export const ProofResponseSchema = z.union([
  ProofSuccessSchema,
  ProofUnverifiableSchema,
]);

export interface ProofSuccess {
  readonly receipt: RowReceipt;
  readonly redacted: boolean;
  readonly redactedPaths?: string[];
  readonly chainLength: number;
}

/**
 * Collect the names of every redactable key present anywhere in `value` (the count + paths the wire's
 * `redactedPaths` reports, and the boolean that decides `redacted`). Mirrors `redactValue`'s walk:
 * object keys matched case-insensitively, arrays walked element-wise (indices are never keys).
 */
function collectRedactedKeys(
  value: unknown,
  keys: ReadonlySet<string>,
  out: Set<string>,
): void {
  if (Array.isArray(value)) {
    for (const v of value) collectRedactedKeys(v, keys, out);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isRedactedKey(k, keys)) out.add(k);
      else collectRedactedKeys(v, keys, out);
    }
  }
}

/**
 * Build the success body from a raw single-row proof. The load-bearing security step is H3: any
 * secret-bearing field is masked SERVER-SIDE here, so the receipt's `raw.payload` (which crosses the
 * wire, is copied, and lands in the exported pack) carries the REDACTED payload for a redacted row —
 * the original never leaves the server. Because the client then receives only the masked payload it
 * genuinely cannot recompute the original hash, which is exactly why leg 1 is `na` and the row's
 * honest state is `anchor-confirmed-original-not-disclosed` (CR-06). The server-computed `checks` are
 * DISPLAY-ONLY (M3) — the client re-derives its chip from `raw`, never from these.
 */
export async function assembleProofSuccess(
  proof: RowProof,
  now: Date,
): Promise<ProofSuccess> {
  const { entry, anchorForRow, chainLength } = proof;

  const redactedKeys = new Set<string>();
  collectRedactedKeys(entry.payload, DEFAULT_REDACT_KEYS, redactedKeys);
  const redacted = redactedKeys.size > 0;

  const wirePayload: JsonValue = redacted
    ? (redactValue(entry.payload, DEFAULT_REDACT_KEYS) as JsonValue)
    : entry.payload;
  const wireEntry: AuditChainEntry = { ...entry, payload: wirePayload };

  const checks = await verifyEntryAgainstAnchor(wireEntry, anchorForRow, {
    redacted,
  });
  const receipt = buildRowReceipt({
    entry: wireEntry,
    anchorForRow,
    redacted,
    checks,
    verifiedAt: now.toISOString(),
    // GATE-1 / ADR-0344: carry the anchor's `sig`/`keyId`/`genesisHash` so the client can run its OWN
    // signature leg against a pinned, out-of-band key — the fix that makes the online "(signature-
    // checked)" seal honest (the client verifies a signature; without this the sig never crossed the
    // wire). All three fields are public; the internal WORM key is still never included (L2).
    includeAnchorProvenance: true,
  });

  return redacted
    ? {
        receipt,
        redacted,
        chainLength,
        redactedPaths: [...redactedKeys].sort(),
      }
    : { receipt, redacted, chainLength };
}
