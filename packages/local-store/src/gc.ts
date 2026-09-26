// src/gc.ts — dedup-on-write + TTL/GC decay default (ADR-0067). The retention POLICY layered ON TOP
// of the store's `upsert`-by-id: content dedup so a near-duplicate fact is REINFORCED not copied,
// a default sliding TTL, and a GC pass that drops expired / decayed / over-cap items. Buyer-config
// (`GcConfig`, validated `.strict()` at the boundary) with sane defaults.
//
// Engine-neutral + PURE: every function is deterministic for a fixed (`items`, `config`, `now`) — no
// clock, randomness, env, or I/O (the caller passes `now` as epoch-ms so the policy is reproducible and
// golden-able). It operates over the `MemoryItem` boundary record (which carries `createdAt`/`expiresAt`/
// `scope`), NOT the `bun:sqlite` store: `LocalStore`'s public surface is `upsert`/`hybridSearch` (no row
// enumeration or delete), so dedup/GC compose at the record layer the consuming edition owns — it holds
// the authoritative item set, asks this engine what to write and what to evict, then drives the store
// (`upsert` the kept items, re-materialize without the dropped). Down-only (ADR-0022): no edition import.
import { z } from "zod";
import { createHash } from "node:crypto";
import { parseStrict, strictObject } from "@caisson-sh/kernel";
import type { MemoryItem } from "./schema.ts";

/** Default retention-score floor: below this a (decay-enabled) item is GC-eligible. 0..1. */
const DEFAULT_DECAY_FLOOR = 0.05;

/**
 * Buyer-config for the retention policy — validated `.strict()` at the boundary (ADR-0002). Every knob
 * is optional with a documented off-state, so the zero-config default is "dedup-on-write only" (no TTL,
 * no decay, no cap): an absent knob never invents a deadline.
 */
const GcConfigSchema = strictObject({
  /**
   * Sliding default TTL (ms) applied on write to an item with no explicit `expiresAt`, and the window
   * reinforcement slides forward. Absent ⇒ no default TTL (items without an explicit `expiresAt` never
   * auto-expire). An explicit `expiresAt` is an absolute deadline this default never overrides.
   */
  defaultTtlMs: z.number().int().positive().optional(),
  /**
   * Decay half-life (ms): an item's retention score halves every half-life since its recency basis
   * (`createdAt`, which reinforcement resets). Absent ⇒ decay off (GC is TTL/cap-only).
   */
  halfLifeMs: z.number().int().positive().optional(),
  /** Retention-score floor below which a decay-enabled item is GC'd as decayed. Default 0.05. */
  decayFloor: z.number().min(0).max(1).default(DEFAULT_DECAY_FLOOR),
  /**
   * Max retained items PER scope after GC; the lowest-retention overflow is evicted. Absent ⇒
   * unbounded (no cap).
   */
  maxPerScope: z.number().int().positive().optional(),
});

/** Boundary-valid retention config. */
export type GcConfig = z.infer<typeof GcConfigSchema>;

/** Parse untrusted buyer retention config, throwing a redaction-safe `ValidationError` (ADR-0002). */
export function parseGcConfig(input: unknown): GcConfig {
  return parseStrict(GcConfigSchema, input);
}

/**
 * Normalize text for content dedup: trim, collapse internal whitespace runs to one space, lowercase.
 * Two items that differ only in surrounding/interior whitespace or case are treated as the same fact
 * (the "near-duplicate" the reinforce path collapses), so trivial reformatting never spawns a row.
 */
function normalizeForDedup(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Lowercase hex SHA-256 over the dedup-normalized text — the stable content fingerprint. */
export function contentDigest(text: string): string {
  return createHash("sha256").update(normalizeForDedup(text)).digest("hex");
}

/**
 * The dedup key: a NUL-joined `(scope, contentDigest)`. Dedup is scoped — the same content under two
 * scopes is two facts — and the NUL separator keeps a scope ending in hex from colliding with a digest.
 */
export function dedupKey(item: Pick<MemoryItem, "scope" | "text">): string {
  return `${item.scope}\u0000${contentDigest(item.text)}`;
}

/**
 * Apply the default sliding TTL on write: when `item` has no explicit `expiresAt` and a `defaultTtlMs`
 * is configured, set `expiresAt = createdAt + defaultTtlMs`. An explicit `expiresAt` (absolute caller
 * deadline) is left untouched. Pure — returns the same reference when nothing changes.
 */
export function applyTtlDefault(
  item: MemoryItem,
  config: GcConfig,
): MemoryItem {
  if (item.expiresAt !== undefined || config.defaultTtlMs === undefined) {
    return item;
  }
  return { ...item, expiresAt: item.createdAt + config.defaultTtlMs };
}

/**
 * Reinforce a kept fact hit by a duplicate write: reset its recency basis (`createdAt`, the documented
 * decay basis) to `now` so the decay clock restarts, and slide the default TTL window forward from
 * `now`. Its id and content are preserved (reinforced, never copied). An explicit hard `expiresAt`
 * (set without a `defaultTtlMs`) is honored, not extended — only the sliding default window moves.
 */
function reinforce(
  item: MemoryItem,
  config: GcConfig,
  now: number,
): MemoryItem {
  if (config.defaultTtlMs !== undefined) {
    return { ...item, createdAt: now, expiresAt: now + config.defaultTtlMs };
  }
  return { ...item, createdAt: now };
}

/**
 * The write decision: `insert` a brand-new (TTL-applied) item, or `reinforce` the existing duplicate
 * (carrying its id in `duplicateOf`) instead of writing a second row. The consumer `upsert`s `item` in
 * both cases — for `reinforce` that re-`upsert`s the existing id, collapsing the duplicate by design.
 */
export type WriteDecision =
  | { readonly action: "insert"; readonly item: MemoryItem }
  | {
      readonly action: "reinforce";
      readonly item: MemoryItem;
      readonly duplicateOf: string;
    };

/**
 * Decide dedup-on-write for `candidate` against the `existing` items (typically the candidate's scope
 * slice — the consumer narrows the set). Same-dedup-key hit ⇒ `reinforce` the existing item; otherwise
 * ⇒ `insert` the candidate with the default TTL applied. Pure + deterministic (first key match wins).
 */
export function decideWrite(
  existing: readonly MemoryItem[],
  candidate: MemoryItem,
  config: GcConfig,
  now: number,
): WriteDecision {
  const key = dedupKey(candidate);
  const dup = existing.find((e) => dedupKey(e) === key);
  if (dup === undefined) {
    return { action: "insert", item: applyTtlDefault(candidate, config) };
  }
  return {
    action: "reinforce",
    item: reinforce(dup, config, now),
    duplicateOf: dup.id,
  };
}

/** `true` once `item` has an `expiresAt` at or before `now` (TTL elapsed). No expiry ⇒ never expired. */
export function isExpired(item: MemoryItem, now: number): boolean {
  return item.expiresAt !== undefined && item.expiresAt <= now;
}

/**
 * Exponential retention score in `(0, 1]`: `0.5 ** (age / halfLifeMs)`, where `age = now - createdAt`
 * (floored at 0). 1.0 at the recency basis, halving every half-life — the decay curve GC reads.
 */
export function retentionScore(
  item: MemoryItem,
  now: number,
  halfLifeMs: number,
): number {
  const age = Math.max(0, now - item.createdAt);
  return 0.5 ** (age / halfLifeMs);
}

/** Why an item was dropped by `planGc`. */
export type GcReason = "expired" | "decayed" | "overflow";

/** One GC eviction: the dropped item and the reason it was evicted. */
export interface GcDrop {
  readonly item: MemoryItem;
  readonly reason: GcReason;
}

/** A GC plan: the items to keep and the items to evict (each with its reason). Disjoint + total. */
export interface GcPlan {
  readonly keep: MemoryItem[];
  readonly drop: GcDrop[];
}

/** Retention ordering value: the decay score when decay is on, else recency (`createdAt`). */
function retentionOf(item: MemoryItem, config: GcConfig, now: number): number {
  return config.halfLifeMs !== undefined
    ? retentionScore(item, now, config.halfLifeMs)
    : item.createdAt;
}

/** Higher-retention first; deterministic tie-break by newer `createdAt`, then ascending id. */
function compareRetention(
  a: MemoryItem,
  b: MemoryItem,
  config: GcConfig,
  now: number,
): number {
  const ra = retentionOf(a, config, now);
  const rb = retentionOf(b, config, now);
  if (rb !== ra) return rb - ra;
  if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Plan a GC pass over `items` at `now` (pure + deterministic): drop in order of precedence —
 *   1. `expired`  — `expiresAt <= now` (TTL elapsed),
 *   2. `decayed`  — decay on AND retention score `< decayFloor`,
 *   3. `overflow` — more than `maxPerScope` survivors in a scope; the lowest-retention are evicted.
 * Everything else is kept. The consumer applies the plan against its store (re-materialize without the
 * dropped rows). `keep` preserves input order in the uncapped path; the cap path groups by scope.
 */
export function planGc(
  items: readonly MemoryItem[],
  config: GcConfig,
  now: number,
): GcPlan {
  const keep: MemoryItem[] = [];
  const drop: GcDrop[] = [];

  const survivors: MemoryItem[] = [];
  for (const item of items) {
    if (isExpired(item, now)) {
      drop.push({ item, reason: "expired" });
      continue;
    }
    if (
      config.halfLifeMs !== undefined &&
      retentionScore(item, now, config.halfLifeMs) < config.decayFloor
    ) {
      drop.push({ item, reason: "decayed" });
      continue;
    }
    survivors.push(item);
  }

  const { maxPerScope } = config;
  if (maxPerScope === undefined) {
    keep.push(...survivors);
    return { keep, drop };
  }

  const byScope = new Map<string, MemoryItem[]>();
  for (const item of survivors) {
    const arr = byScope.get(item.scope);
    if (arr === undefined) byScope.set(item.scope, [item]);
    else arr.push(item);
  }
  for (const arr of byScope.values()) {
    const ordered = [...arr].sort((a, b) =>
      compareRetention(a, b, config, now),
    );
    keep.push(...ordered.slice(0, maxPerScope));
    for (const item of ordered.slice(maxPerScope)) {
      drop.push({ item, reason: "overflow" });
    }
  }
  return { keep, drop };
}
