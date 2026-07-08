// src/embed-cache.ts — content-hash embedding cache. The docs corpus is re-embedded from scratch
// on every boot (the index is in-memory), so every redeploy pays the full corpus in OpenRouter
// calls even when not one chunk changed. This decorator wraps any `Embedder`: a hit returns the
// stored vector with NO network call; a miss delegates to the inner embedder and records the
// result. Persisted as one JSON file (tmp+rename atomic) on a durable path (the Railway volume),
// so a redeploy re-embeds only chunks whose text — or the model/dim — actually changed.
//
// The cache key is the sha256 of the RAW text (pre-egress-scrub), so keys are deterministic and
// the guarded inner embedder still scrubs anything that does go over the wire. A model or dim
// change invalidates the whole file (vectors from different models are not comparable); a
// wrong-width entry is dropped on load rather than corrupting the vec index. Known limit: a
// change to the egress-scrub rules alone does not invalidate entries (key = raw text) — a
// scrub-rule change ships with a corpus/model touch in practice, and the staleness cost is
// retrieval quality on the affected chunk, never a leak.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import type { Embedder } from "@caisson/local-store";

/** On-disk shape. Parsed LENIENTLY on load — an absent/corrupt/foreign file is a cold start,
 *  never an error (the cache is an optimization, not a source of truth). */
const CacheFileSchema = z.object({
  version: z.literal(1),
  model: z.string(),
  dim: z.number().int().positive(),
  entries: z.record(z.string(), z.array(z.number())),
});

export function cacheKey(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function loadEntries(
  path: string,
  model: string,
  dim: number,
): Map<string, number[]> {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return new Map(); // no cache file yet — cold start
  }
  try {
    const parsed = CacheFileSchema.parse(JSON.parse(raw));
    // Model/dim drift ⇒ the stored vectors live in a different space: full re-embed.
    if (parsed.model !== model || parsed.dim !== dim) return new Map();
    const entries = new Map<string, number[]>();
    for (const [key, vector] of Object.entries(parsed.entries)) {
      if (vector.length === dim) entries.set(key, vector);
    }
    return entries;
  } catch {
    return new Map(); // corrupt/foreign file — cold start, the next save overwrites it
  }
}

/** Hard ceiling on cached entries. The boot corpus (~hundreds of chunks) fills first; query-time
 *  embeds use whatever room remains. Once full, new vectors are returned but NOT stored — no
 *  eviction, so the persisted boot corpus can never be pushed out by query traffic, and a caller
 *  streaming distinct query text can't grow the map without bound (each entry is a ~1k-float
 *  vector; the cap bounds worst-case memory to tens of MB).
 *  ponytail: skip-set over LRU — eviction buys nothing here since the hot set IS the boot corpus. */
const DEFAULT_MAX_ENTRIES = 2048;

/**
 * Caching decorator over an `Embedder`. Query-time embeds also flow through it (repeat queries
 * are free in-memory), but only `save()` — called once after the boot build — persists; a cache
 * write failure costs a future re-embed, never the boot. Concurrent embeds of the SAME text
 * single-flight onto one inner call. An embed that completes after `save()` has already run
 * (e.g. past the boot embed-phase deadline) is kept in memory but not persisted this boot — it
 * just re-embeds next redeploy; save() is deliberately once-per-boot, not a write-through.
 */
export class CachedEmbedder implements Embedder {
  readonly dim: number;
  hits = 0;
  misses = 0;
  private dirty = false;
  private readonly maxEntries: number;
  private readonly entries: Map<string, number[]>;
  private readonly inflight = new Map<string, Promise<number[]>>();

  constructor(
    private readonly inner: Embedder,
    private readonly path: string,
    private readonly model: string,
    opts?: { maxEntries?: number },
  ) {
    this.dim = inner.dim;
    this.maxEntries = opts?.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.entries = loadEntries(path, model, inner.dim);
  }

  /** Number of usable entries loaded/accumulated (exposed for the boot log + tests). */
  get size(): number {
    return this.entries.size;
  }

  embed(text: string): Promise<number[]> {
    const key = cacheKey(text);
    const hit = this.entries.get(key);
    if (hit !== undefined) {
      this.hits++;
      return Promise.resolve(hit);
    }
    // Single-flight: a second caller with the same text joins the in-progress inner call
    // instead of paying a redundant network embed.
    const pending = this.inflight.get(key);
    if (pending !== undefined) {
      this.hits++;
      return pending;
    }
    this.misses++;
    const call = this.inner.embed(text).then(
      (vector) => {
        this.inflight.delete(key);
        if (this.entries.size < this.maxEntries) {
          this.entries.set(key, vector);
          this.dirty = true;
        }
        return vector;
      },
      (err: unknown) => {
        this.inflight.delete(key);
        throw err;
      },
    );
    this.inflight.set(key, call);
    return call;
  }

  /** Persist accumulated entries (atomic tmp+rename). Fail-soft by design. */
  save(): void {
    if (!this.dirty) return;
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      const tmp = `${this.path}.tmp`;
      writeFileSync(
        tmp,
        JSON.stringify({
          version: 1,
          model: this.model,
          dim: this.dim,
          entries: Object.fromEntries(this.entries),
        }),
      );
      renameSync(tmp, this.path);
      this.dirty = false;
    } catch {
      // A cache persist failure is invisible to correctness — the next boot just re-embeds.
    }
  }
}
