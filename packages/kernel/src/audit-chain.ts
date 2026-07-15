// SHA-256 append-only audit chain (ADR-0006). A tamper-evident sequence: each entry binds the
// previous entry's hash, so altering an interior entry, inserting, reordering, or dropping a
// MIDDLE entry breaks every hash from that point on — `verifyChain` reports the FIRST broken index.
// Reused verbatim by the Compliance edition over locked artifact versions (the SEC 17a-4
// audit-trail alternative path).
//
// LIMIT — internal consistency is NOT enough on its own. A chain has nothing after its tip, so a
// TAIL truncation (drop the last N entries) leaves a still-internally-consistent chain, and a
// WHOLESALE REWRITE (rebuild a fresh self-consistent chain over forged payloads) verifies clean
// too. Detecting those requires a TRUSTED ANCHOR — a committed (length, tipHash[, genesisHash])
// triple held in WORM/append-only storage outside the chain. Pass it to `verifyChain(entries,
// anchor)` and truncation + rewrite are caught; without an anchor, `verifyChain` only proves the
// supplied entries are mutually consistent, not that they are the COMPLETE, original chain.
//
// Canonicalization is load-bearing: the hash is taken over a DETERMINISTIC serialization (recursive
// key sorting), so two semantically-equal payloads that differ only in key order produce the same
// hash — the chain is reproducible across machines, languages, and JSON serializers. This is NOT a
// secret comparison (the hashes are public integrity tags), so plain equality is correct here; the
// `crypto.timingSafeEqual` discipline applies to secrets/tokens/HMACs, not content hashes.
//
// The pure serialization + value TYPES were extracted to the node-free `canonical.ts` (T-K1) so the
// browser per-row verify path can reach them without pulling this module's `node:crypto`. They are
// re-exported below so the `.` barrel API stays byte-identical (index.ts + migration-assembly.ts
// import them FROM here).
import { createHash } from "node:crypto";
import { canonicalize } from "./canonical.ts";
import type {
  JsonValue,
  AuditChainEntry,
  ChainVerification,
  AuditChainAnchor,
} from "./canonical.ts";

export { canonicalize };
export type { JsonValue, AuditChainEntry, ChainVerification, AuditChainAnchor };

/**
 * Content-integrity tag for a SINGLE frozen claim/artifact (ADR-0229 row 10): lowercase-hex SHA-256
 * over `canonicalize(value)` — no chain wrapper, unlike {@link hashChainLink} (which hashes the
 * `[prevHash, payload]` 2-tuple). Use to pin the integrity of one immutable value independent of any
 * chain (a locked artifact, a policy snapshot). NOT a secret comparison — the digest is a public
 * integrity tag, so plain equality on the result is correct (same rationale as the chain hashes).
 */
export function contentHash(value: JsonValue): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
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

/** Mint the trusted anchor for a chain: its length, tip hash, and genesis hash. */
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
 * Verify a chain end to end. An entry is intact iff its `seq` equals its position, its `prevHash`
 * equals the predecessor's `hash` (or `null` at genesis), and its `hash` recomputes from
 * `(prevHash, payload)`. Returns the FIRST broken index — interior tamper, insert, reorder, or
 * MIDDLE drop surfaces there.
 *
 * WITHOUT an `anchor` this proves only that the supplied entries are mutually consistent — a tail
 * truncation or a fully-rebuilt forged chain still returns `{ valid: true }`. WITH a trusted
 * `anchor`, the committed length + tip hash (+ optional genesis) are asserted after the
 * consistency pass, so truncation and wholesale rewrite are caught.
 */
export function verifyChain(
  entries: readonly AuditChainEntry[],
  anchor?: AuditChainAnchor,
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
  if (anchor !== undefined) {
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
      return {
        valid: false,
        brokenAt: Math.min(entries.length, anchor.length),
      };
    }
    // Tip mismatch on an equal-length, internally-consistent chain → wholesale rewrite.
    const tip = entries[entries.length - 1] as AuditChainEntry;
    if (tip.hash !== anchor.tipHash) {
      return { valid: false, brokenAt: entries.length - 1 };
    }
  }
  return { valid: true, brokenAt: null };
}
