// Pure, node-free canonicalization + audit-chain value types — extracted from audit-chain.ts (T-K1).
// This module holds ONLY the deterministic serialization and the JSON value/entry/anchor/verification
// TYPES; it imports no node builtin, so it is browser/edge-safe and can be pulled into a client
// bundle. The per-row WebCrypto verify path (`audit-verify.ts`) imports THIS, never the node-tainted
// `audit-chain.ts` (whose `createHash` from the node crypto builtin taints the `.` barrel).
//
// Canonicalization is load-bearing: the hash is taken over a DETERMINISTIC serialization (recursive
// key sorting), so two semantically-equal payloads that differ only in key order produce the same
// hash — the chain is reproducible across machines, languages, and JSON serializers. This is NOT a
// secret comparison (the hashes are public integrity tags), so plain equality is correct downstream;
// the `crypto.timingSafeEqual` discipline applies to secrets/tokens/HMACs, not content hashes. Any
// change to the bytes produced here is a chain-format break — it would invalidate every stored hash.

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

export interface ChainVerification {
  /** True iff every entry's seq, prevHash linkage, and recomputed hash are intact. */
  readonly valid: boolean;
  /** The index of the first broken entry, or `null` when the whole chain verifies. */
  readonly brokenAt: number | null;
}

/**
 * A trusted commitment over a chain, held OUTSIDE the chain (WORM / append-only store). Pinning it
 * is what lets `verifyChain` catch tail-truncation and wholesale rewrite, which internal
 * consistency alone cannot. Mint one with `anchorChain` after each append and persist it.
 */
export interface AuditChainAnchor {
  /** Committed total entry count. A supplied chain with fewer entries = truncation. */
  readonly length: number;
  /** Committed hash of the tip (last entry). A different tip = rewrite or truncation. */
  readonly tipHash: string;
  /** Optional committed genesis hash (`entries[0].hash`) — pins the chain's root. */
  readonly genesisHash?: string;
  /**
   * Optional base64 Ed25519 signature over the anchor's CANONICAL CORE bytes (`{length, tipHash,
   * genesisHash?}`, T-W2 / GATE-1). ADDITIVE and EXCLUDED from the canonical core itself, so a
   * legacy unsigned anchor stays byte-identical and this is never a chain-format break. Verified
   * against a pinned public key by the client / offline pack, making tamper-evidence independent of
   * the row-serving API.
   */
  readonly sig?: string;
  /** Optional anchor-signing identity id paired with {@link sig} (rotation/lookup; never a secret). */
  readonly keyId?: string;
}
