// SHA-256 append-only audit chain (ADR-0006). A tamper-evident sequence: each entry binds the
// previous entry's hash, so altering, inserting, reordering, or dropping any entry breaks every
// hash from that point on. `verifyChain` reports the FIRST broken index. Reused verbatim by the
// Compliance edition over locked artifact versions (the SEC 17a-4 audit-trail alternative path).
//
// Canonicalization is load-bearing: the hash is taken over a DETERMINISTIC serialization (recursive
// key sorting), so two semantically-equal payloads that differ only in key order produce the same
// hash — the chain is reproducible across machines, languages, and JSON serializers. This is NOT a
// secret comparison (the hashes are public integrity tags), so plain equality is correct here; the
// `crypto.timingSafeEqual` discipline applies to secrets/tokens/HMACs, not content hashes.
import { createHash } from "node:crypto";

/** A JSON-serializable value. The audit payload must be canonicalizable, so it is JSON, not `any`. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface AuditChainEntry {
  /** 0-based position in the chain. Genesis is 0. */
  readonly seq: number;
  /** The previous entry's `hash`, or `null` at genesis. Binds this entry to its predecessor. */
  readonly prevHash: string | null;
  /** The canonicalizable payload this entry commits to. */
  readonly payload: JsonValue;
  /** Lowercase hex SHA-256 over `canonicalize([prevHash, payload])`. */
  readonly hash: string;
}

/** Recursively sort object keys; preserve array order; reject non-finite numbers (not JSON). */
function sortValue(value: JsonValue): JsonValue {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error(
        `audit-chain: non-finite number is not canonicalizable: ${String(value)}`,
      );
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(sortValue);
  const obj = value as { readonly [key: string]: JsonValue };
  const out: { [key: string]: JsonValue } = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortValue(obj[key] as JsonValue);
  }
  return out;
}

/**
 * Deterministic serialization of a JSON value: object keys sorted recursively, array order kept.
 * The single source of canonical bytes for the chain hash — document any change as a chain-format
 * break (it would invalidate every previously-computed hash).
 */
export function canonicalize(value: JsonValue): string {
  return JSON.stringify(sortValue(value));
}

/**
 * The chain link hash: SHA-256 over the canonical serialization of `[prevHash, payload]`. The
 * 2-tuple binds the predecessor hash and the payload unambiguously (JSON's own delimiters separate
 * them — no `prevHash ∥ payload` concatenation ambiguity).
 */
export function hashChainLink(
  prevHash: string | null,
  payload: JsonValue,
): string {
  return createHash("sha256")
    .update(canonicalize([prevHash, payload]))
    .digest("hex");
}

/**
 * Build the next entry. `prev = null` mints genesis (seq 0, prevHash null); otherwise this entry
 * binds `prev.hash` and takes `prev.seq + 1`.
 */
export function chainEntry(
  prev: AuditChainEntry | null,
  payload: JsonValue,
): AuditChainEntry {
  const prevHash = prev === null ? null : prev.hash;
  const seq = prev === null ? 0 : prev.seq + 1;
  return { seq, prevHash, payload, hash: hashChainLink(prevHash, payload) };
}

/** Fold a list of payloads into a complete chain, oldest first. */
export function buildChain(payloads: readonly JsonValue[]): AuditChainEntry[] {
  const entries: AuditChainEntry[] = [];
  let prev: AuditChainEntry | null = null;
  for (const payload of payloads) {
    prev = chainEntry(prev, payload);
    entries.push(prev);
  }
  return entries;
}

export interface ChainVerification {
  /** True iff every entry's seq, prevHash linkage, and recomputed hash are intact. */
  readonly valid: boolean;
  /** The index of the first broken entry, or `null` when the whole chain verifies. */
  readonly brokenAt: number | null;
}

/**
 * Verify a chain end to end. An entry is intact iff its `seq` equals its position, its `prevHash`
 * equals the predecessor's `hash` (or `null` at genesis), and its `hash` recomputes from
 * `(prevHash, payload)`. Returns the FIRST broken index — any tamper, insert, reorder, or drop
 * surfaces there.
 */
export function verifyChain(
  entries: readonly AuditChainEntry[],
): ChainVerification {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i] as AuditChainEntry;
    const expectedPrev =
      i === 0 ? null : (entries[i - 1] as AuditChainEntry).hash;
    if (entry.seq !== i) return { valid: false, brokenAt: i };
    if (entry.prevHash !== expectedPrev) return { valid: false, brokenAt: i };
    if (entry.hash !== hashChainLink(entry.prevHash, entry.payload)) {
      return { valid: false, brokenAt: i };
    }
  }
  return { valid: true, brokenAt: null };
}
