// Pre-call MinHash/LSH dedup-before-meter gate (ADR-0217). `reserve()`'s idempotency
// (`usage_event (account, call_id)` UNIQUE) catches only a literal retry of the SAME call — it
// misses two DIFFERENT calls whose prompts are near-identical (an agent loop rewording a retry, a
// user re-asking the same question), each paying a fresh reservation + provider call.
// `checkDedupGate()` detects a likely-redundant prompt BEFORE the price-book estimate/debit, so a
// caller (ai-kit gateway, agent-runner, support-bot) can choose to skip or reuse — this module
// DETECTS only, it never auto-skips or auto-reuses, and it moves zero wallet credits.
//
// Algorithm: normalize the prompt → k-word shingles → a MinHash signature (`numHashes` independent
// `(a·h(x)+b) mod p` permutations over one FNV-1a base hash, signature = per-function min) → LSH
// band keys for a bounded candidate lookup → Jaccard-estimate similarity against the highest-scoring
// candidate. Pure, dependency-free hashing core; the store is an injected port so a caller can swap
// the bounded in-memory default for a persistent one later without touching this file.
import { z } from "zod";
import { parseStrict, strictObject } from "@caisson-sh/kernel";
import { estimateMessageSchema } from "./estimate.ts";
import type { EstimateMessage } from "./estimate.ts";

/** Join every message's content, lowercased + whitespace-collapsed — the shingling input. */
export function normalizePrompt(messages: EstimateMessage[]): string {
  return messages
    .map((m) => m.content)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** `k`-word sliding shingles over whitespace-split `text` (shorter-than-`k` text → one shingle). */
export function shingle(text: string, k = 3): string[] {
  const words = text.split(" ").filter((w) => w.length > 0);
  if (words.length === 0) return [];
  if (words.length <= k) return [words.join(" ")];
  const shingles: string[] = [];
  for (let i = 0; i <= words.length - k; i++) {
    shingles.push(words.slice(i, i + k).join(" "));
  }
  return shingles;
}

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a 32-bit hash — the sole hash primitive MinHash permutes over (no dependency). */
function fnv1a(text: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/** A prime just above 2^32 — the MinHash permutation modulus. */
const MINHASH_PRIME = 4294967311n;

/**
 * Deterministic per-index permutation coefficients. MUST be fixed across calls: two signatures are
 * only comparable if the same (a, b) pairs produced both, so this is derived from the index alone,
 * never randomized.
 */
function permutationCoefficient(prefix: "a" | "b", index: number): bigint {
  return BigInt(fnv1a(`${prefix}:${index}`)) % MINHASH_PRIME;
}

/** `numHashes` independent `(a·h(x)+b) mod p` permutations over the shingles' FNV-1a hashes. */
export function computeMinHashSignature(
  shingles: string[],
  numHashes = 32,
): Uint32Array {
  const signature = new Uint32Array(numHashes);
  if (shingles.length === 0) {
    // No shingles (an empty prompt): every function's min is a stable sentinel, so two empty
    // prompts still compare as identical — which is the correct answer (empty vs empty IS a dup).
    signature.fill(0xffffffff);
    return signature;
  }
  const baseHashes = shingles.map((s) => BigInt(fnv1a(s)));
  for (let i = 0; i < numHashes; i++) {
    const a = permutationCoefficient("a", i) || 1n;
    const b = permutationCoefficient("b", i);
    let min = MINHASH_PRIME;
    for (const h of baseHashes) {
      const v = (a * h + b) % MINHASH_PRIME;
      if (v < min) min = v;
    }
    signature[i] = Number(min);
  }
  return signature;
}

/** Band `sig` into `bands` groups of `rows` entries — the LSH candidate-lookup keys. */
export function lshBands(sig: Uint32Array, bands = 16, rows = 2): string[] {
  if (bands * rows !== sig.length) {
    throw new Error(
      `lshBands: bands*rows (${bands * rows}) must equal the signature length (${sig.length})`,
    );
  }
  const keys: string[] = [];
  for (let b = 0; b < bands; b++) {
    const start = b * rows;
    keys.push(`${b}:${sig.subarray(start, start + rows).join(",")}`);
  }
  return keys;
}

/** Fraction of matching positions across two equal-length MinHash signatures. */
export function jaccardEstimate(a: Uint32Array, b: Uint32Array): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) matches++;
  }
  return matches / a.length;
}

/** One prior call's signature, kept for candidate lookup. */
export interface DedupEntry {
  callId: string;
  signature: Uint32Array;
  at: Date;
}

/**
 * The dedup candidate-store port — every call `accountId`+`scope` keyed. A Postgres-backed
 * implementation is a later wave (out of scope here); this file only depends on the interface.
 */
export interface DedupStore {
  candidates(
    accountId: string,
    scope: string,
    bucketKeys: string[],
  ): DedupEntry[] | Promise<DedupEntry[]>;
  insert(
    accountId: string,
    scope: string,
    bucketKeys: string[],
    entry: DedupEntry,
  ): void | Promise<void>;
}

interface RingEntry {
  entry: DedupEntry;
  bucketKeys: Set<string>;
}

/**
 * A bounded, per-`${accountId}:${scope}` ring buffer, linear-scanned for bucket-key overlap.
 * Capacity is small by design — a real bucket-indexed Map only pays off past a few
 * thousand entries, and this store's bound (`capacity`, default 200) never gets there.
 */
export function createInMemoryDedupStore(capacity = 200): DedupStore {
  const buckets = new Map<string, RingEntry[]>();
  const bucketId = (accountId: string, scope: string): string =>
    `${accountId}:${scope}`;

  return {
    candidates(accountId, scope, bucketKeys) {
      const ring = buckets.get(bucketId(accountId, scope));
      if (ring === undefined) return [];
      const wanted = new Set(bucketKeys);
      const hits: DedupEntry[] = [];
      for (const r of ring) {
        for (const k of r.bucketKeys) {
          if (wanted.has(k)) {
            hits.push(r.entry);
            break;
          }
        }
      }
      return hits;
    },
    insert(accountId, scope, bucketKeys, entry) {
      const key = bucketId(accountId, scope);
      const ring = buckets.get(key) ?? [];
      ring.push({ entry, bucketKeys: new Set(bucketKeys) });
      if (ring.length > capacity) ring.shift();
      buckets.set(key, ring);
    },
  };
}

const dedupGateInputSchema = strictObject({
  accountId: z.string().min(1),
  scope: z.string().min(1),
  callId: z.string().min(1),
  messages: z.array(estimateMessageSchema),
});

export interface DedupGateConfig {
  store: DedupStore;
  /** Similarity at/above which a candidate counts as a duplicate. Default 0.92 (conservative). */
  threshold?: number;
  numHashes?: number;
  bands?: number;
  rows?: number;
}

export type DedupGateResult =
  | { kind: "proceed" }
  | { kind: "duplicate-of"; callId: string; similarity: number; at: Date };

const DEFAULT_THRESHOLD = 0.92;
const DEFAULT_NUM_HASHES = 32;
const DEFAULT_BANDS = 16;
const DEFAULT_ROWS = 2;

/**
 * Detect whether `input.messages` is a near-duplicate of a recent call in `config.store`, keyed to
 * `input.accountId`+`input.scope`. Caller-invoked BEFORE `reserve()` (see the JSDoc pointer on
 * `reserve()` in `meter.ts`) — a `duplicate-of` result lets the caller skip the provider call AND
 * the reservation; this gate never debits, and it never auto-skips on the caller's behalf.
 *
 * Order matters: the new signature is matched against existing candidates FIRST, THEN inserted —
 * a call must never match its own just-inserted signature.
 */
export async function checkDedupGate(
  input: {
    accountId: string;
    scope: string;
    callId: string;
    messages: EstimateMessage[];
  },
  config: DedupGateConfig,
): Promise<DedupGateResult> {
  const core = parseStrict(dedupGateInputSchema, input);
  const numHashes = config.numHashes ?? DEFAULT_NUM_HASHES;
  const bands = config.bands ?? DEFAULT_BANDS;
  const rows = config.rows ?? DEFAULT_ROWS;
  const threshold = config.threshold ?? DEFAULT_THRESHOLD;

  const signature = computeMinHashSignature(
    shingle(normalizePrompt(core.messages)),
    numHashes,
  );
  const bucketKeys = lshBands(signature, bands, rows);

  const candidates = await config.store.candidates(
    core.accountId,
    core.scope,
    bucketKeys,
  );

  let best: { callId: string; similarity: number; at: Date } | null = null;
  for (const candidate of candidates) {
    const similarity = jaccardEstimate(signature, candidate.signature);
    if (
      similarity >= threshold &&
      (best === null || similarity > best.similarity)
    ) {
      best = { callId: candidate.callId, similarity, at: candidate.at };
    }
  }

  // Insert AFTER matching (see the JSDoc above): never let a call match its own signature.
  await config.store.insert(core.accountId, core.scope, bucketKeys, {
    callId: core.callId,
    signature,
    at: new Date(),
  });

  if (best !== null) {
    return {
      kind: "duplicate-of",
      callId: best.callId,
      similarity: best.similarity,
      at: best.at,
    };
  }
  return { kind: "proceed" };
}
