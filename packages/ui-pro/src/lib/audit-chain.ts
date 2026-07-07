/**
 * Pure hash-chain verification for AuditTimeline. An append-only audit chain links each entry to its
 * predecessor by carrying the predecessor's hash in `prevHash`; a broken link (a `prevHash` that
 * doesn't match the previous entry's `hash`) is evidence of tampering or a gap. This is a
 * PRESENTATION-side link check over hashes the caller already computed — it recomputes no digests and
 * has no dependency on the audit store, so the timeline stays portable.
 */

export interface ChainEntry {
  /** This entry's content hash (hex/base64 — compared as an exact string). */
  hash: string;
  /** The hash of the entry this one chains onto. Absent on the genesis entry. */
  prevHash?: string;
}

export type LinkStatus = "genesis" | "verified" | "broken";

/**
 * Classify each entry's link to its predecessor, in the given order:
 *   - `genesis` — the first entry (nothing precedes it to verify against).
 *   - `verified` — `prevHash` exactly equals the previous entry's `hash`.
 *   - `broken` — `prevHash` is missing or does not match (a tampered/removed link).
 * Returns one status per entry, index-aligned with `entries`.
 */
export function verifyChain(entries: readonly ChainEntry[]): LinkStatus[] {
  return entries.map((entry, i) => {
    if (i === 0) return "genesis";
    const prev = entries[i - 1]!;
    return entry.prevHash !== undefined && entry.prevHash === prev.hash
      ? "verified"
      : "broken";
  });
}

/** True iff every non-genesis link verifies (the whole chain is intact). */
export function chainIntact(entries: readonly ChainEntry[]): boolean {
  return verifyChain(entries).every((s) => s !== "broken");
}
