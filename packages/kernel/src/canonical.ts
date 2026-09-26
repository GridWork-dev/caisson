// Pure, node-free canonicalization + audit-chain value types — extracted from audit-chain.ts (T-K1).
// This module holds every part of the chain algebra that does NOT hash: the deterministic
// serialization, the JSON value/entry/anchor/verification TYPES, and the two anchor operations
// (`anchorChain` mints a commitment from hashes the chain already holds; `checkAnchor` compares
// them). It imports no node builtin, so it is browser/edge-safe and can be pulled into a client
// bundle. The WebCrypto verify path (`audit-verify.ts`) imports THIS, never the node-tainted
// `audit-chain.ts` (whose `createHash` from the node crypto builtin taints the `.` barrel), and
// `audit-chain.ts` re-exports what belongs on the node surface so that surface is unchanged.
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
 * Mint the trusted anchor for a chain: its length, tip hash, and genesis hash.
 *
 * Pure — it READS hashes the chain already committed and never computes one — so it lives here with
 * the value types rather than in the node-only `audit-chain.ts`, and the node chain builder and the
 * WebCrypto browser/offline verifier mint anchors through ONE implementation. `audit-chain.ts`
 * re-exports it, so `@caisson-sh/kernel/node`'s surface is unchanged.
 */
export function anchorChain(
  entries: readonly AuditChainEntry[],
): AuditChainAnchor {
  if (entries.length === 0) {
    throw new Error("audit-chain: cannot anchor an empty chain");
  }
  const tip = entries[entries.length - 1] as AuditChainEntry;
  return {
    length: entries.length,
    tipHash: tip.hash,
    genesisHash: (entries[0] as AuditChainEntry).hash,
  };
}

/**
 * The ANCHOR half of chain verification: committed root, committed length, committed tip. Returns
 * the failing verdict, or `null` when the anchor holds.
 *
 * Pure for the same reason as {@link anchorChain} — it compares hashes the caller already has — so
 * the sync node `verifyChain` and the async WebCrypto `verifyChainAsync` share one implementation
 * of these fail-closed rules and can never drift into disagreeing about the same chain. Callers run
 * the per-link consistency pass FIRST; these checks are what additionally catch tail truncation and
 * wholesale rewrite, which internal consistency alone cannot.
 */
export function checkAnchor(
  entries: readonly AuditChainEntry[],
  anchor: AuditChainAnchor,
): ChainVerification | null {
  // Genesis mismatch → the chain has the wrong root (a rewrite from entry 0).
  if (
    anchor.genesisHash !== undefined &&
    (entries.length === 0 ||
      (entries[0] as AuditChainEntry).hash !== anchor.genesisHash)
  ) {
    return { valid: false, brokenAt: 0 };
  }
  // Length mismatch → truncation (or extension). Point at the first divergent index.
  if (entries.length !== anchor.length) {
    return { valid: false, brokenAt: Math.min(entries.length, anchor.length) };
  }
  // Tip mismatch on an equal-length, internally-consistent chain → wholesale rewrite.
  const tip = entries[entries.length - 1] as AuditChainEntry;
  if (tip.hash !== anchor.tipHash) {
    return { valid: false, brokenAt: entries.length - 1 };
  }
  return null;
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
   * genesisHash?}`). ADDITIVE and EXCLUDED from the canonical core itself, so a
   * legacy unsigned anchor stays byte-identical and this is never a chain-format break. Verified
   * against a pinned public key by the client / offline pack, making tamper-evidence independent of
   * the row-serving API.
   */
  readonly sig?: string;
  /** Optional anchor-signing identity id paired with {@link sig} (rotation/lookup; never a secret). */
  readonly keyId?: string;
  /** Signature-envelope version. Version 2 binds the anchor to its tenant-scoped WORM account. */
  readonly sigV?: 2;
  /** UUID-shaped WORM account included in the version-2 signature envelope. */
  readonly sigAccountId?: string;
}
