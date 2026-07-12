// src/index-store.ts — DocsIndex (ADR-0096). A thin retrieval wrapper that REUSES @caisson/local-store's
// LocalStore (hybrid bun:sqlite FTS5 + sqlite-vec vec0, RRF-fused, FTS5-floor degrade, ADR-0067) — the
// engine is composed, not rebuilt (ADR-0003 service→base; no-copy-paste). DocsIndex loads DocChunk[]
// into the store (FTS text always; a vector when an Embedder is wired) and maps fused SearchHit ids back
// to the originating chunk + citation. With no embedder, retrieval is the deterministic FTS5 floor.
import { LocalStore, embedOrSkip } from "@caisson/local-store";
import type { Embedder, OptionalEmbedder } from "@caisson/local-store";
import type { DocChunk, ScoredChunk } from "./types.ts";

/** vec0 needs a positive width even when no vectors are stored; dim=1 is an inert FTS-floor placeholder. */
const FTS_FLOOR_DIM = 1;

/** Bounded concurrency for boot-time embedding — enough to parallelize a network embedder, low enough
 * to stay polite to the provider's rate limit. With no embedder the work is a no-op and this is inert. */
const EMBED_CONCURRENCY = 8;

/** Hard ceiling on the WHOLE boot-time embedding phase (ms) — independent of chunk count AND of
 * any single chunk's in-flight retry/backoff. Each `embedOrSkip` call is already bounded by the
 * embedder's own retry+timeout budget (e.g. OpenRouterEmbedder: ~3 attempts x up to 30s, PLUS a
 * real `Retry-After` backoff sleep the provider controls, live-observed to occasionally run
 * minutes on its own during a rate-limited stretch), but that bound is PER CHUNK: a persistently
 * slow/degraded/rate-limited provider multiplies it across every chunk (255 chunks / 8-way
 * concurrency worst case is tens of minutes — observed as a real ~10min stretch of Railway 502s
 * before FTS fallback ever finished). Every `embedOrSkip` call is raced against this deadline
 * (`raceDeadline` below) so a chunk stuck mid-retry can't keep the phase open past it either — the
 * abandoned call keeps running in the background (not cancelled) but its result is discarded.
 * Once the deadline passes, every remaining/in-flight chunk degrades to FTS-only — never a throw,
 * matching the existing per-chunk degrade below.
 * ponytail: a flat 3-minute budget, not scaled to corpus size — live-measured (this fix's own
 * verification run) HEALTHY embedding of the current 255-chunk corpus takes ~70-90s, so 3 minutes
 * leaves real headroom above that baseline while still bounding a genuine outage to minutes, not
 * tens of them. Re-measure and raise (or make it chunk-count-aware) if the corpus roughly doubles
 * again. `deadlineHit` below logs whenever this actually trips, so a silent truncation can't hide. */
const DEFAULT_EMBED_PHASE_DEADLINE_MS = 180_000;

/** Sentinel: `raceDeadline` resolves to this when the deadline wins instead of the real promise. */
const EMBED_DEADLINE = Symbol("embed-phase-deadline");

/** Hard ceiling on the PER-QUERY embed call inside `search` (ms). The boot-phase deadline above
 * bounds corpus embedding, but the query-time embed had NO bound: OpenRouterEmbedder's internal
 * retry + provider-controlled `Retry-After` backoff can run minutes on a rate-limited stretch,
 * while the support-bot's whole request budget is 20s — so a slow (not failing) embed surfaced to
 * buyers as "retrieval unavailable" escalations (battery v2, 2026-07-10: 4/25 questions died
 * exactly this way). Past the deadline the query degrades to the FTS floor — same degrade the
 * catch below already applies to embed ERRORS; slow-success now degrades identically instead of
 * hanging. ponytail: flat 8s — healthy query embeds run well under 2s, and 8s leaves the bot 12s
 * of its 20s budget for retrieval + generation; raise only with a measured healthy-latency shift. */
const DEFAULT_QUERY_EMBED_DEADLINE_MS = 8_000;

/** Race `promise` against the time remaining until `deadlineAt`; never rejects on the deadline
 * side. The loser is NOT cancelled (no cancellation primitive here) — `promise` keeps running in
 * the background if the deadline wins, but `.then` below attaches a real rejection handler to it
 * either way, so an eventual rejection on an abandoned call never surfaces as unhandled. Whichever
 * side settles first clears the OTHER side's timer, so a promise that wins never leaves its
 * deadline timer (and the closure it holds) alive in the background — at the 3-minute default
 * across 255 chunks that would otherwise be hundreds of orphaned timers per boot. */
function raceDeadline<T>(
  promise: Promise<T>,
  deadlineAt: number,
): Promise<T | typeof EMBED_DEADLINE> {
  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0) {
    promise.catch(() => {}); // never awaited below — still needs a handler so it can't go unhandled
    return Promise.resolve(EMBED_DEADLINE);
  }
  return new Promise<T | typeof EMBED_DEADLINE>((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve(EMBED_DEADLINE);
    }, remainingMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Fusion tuning (CAISSON-83, measured on the live 470-chunk corpus 2026-07-12):
 * - FTS_WEIGHT: the FTS (bm25) leg's RRF multiplier. The docs corpus is dense with near-duplicate
 *   "Install"/"What it does" sections, so the vec leg's semantic neighborhood crowds out the
 *   canonical exact-match page (the battery-v2 install-question miss); exact-term evidence gets
 *   the heavier hand. The vec leg still decides everything FTS can't see.
 * - PER_SOURCE_CAP: max chunks from one source document in a top-k answer window. Multiple chunks
 *   of one page carry near-identical information — a window slot spent on a second chunk of the
 *   same page is a slot a distinct candidate page lost.
 * Both are re-measured via the live golden suite (services/docs/live/) — change them only with a
 * green `bun run test:live` in hand.
 */
const DEFAULT_FTS_WEIGHT = 1;
const DEFAULT_PER_SOURCE_CAP = 2;
/** Over-fetch factor before the per-source cap trims the window (cap needs surplus candidates). */
const SEARCH_OVERFETCH = 4;

/** Per-query overrides for the fusion tuning — the live probe sweeps these; production callers
 *  use the defaults. */
export interface SearchTuning {
  ftsWeight?: number;
  perSourceCap?: number;
}

/** Index text = title + section + body, so heading/title terms strengthen the FTS (bm25) leg. */
function indexText(chunk: DocChunk): string {
  return [chunk.title, chunk.section, chunk.text]
    .filter((s) => s.length > 0)
    .join("\n");
}

/** Map `items` through async `fn` with at most `limit` in flight, preserving input order in the result. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i] as T);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return out;
}

export class DocsIndex {
  private constructor(
    private readonly store: LocalStore,
    private readonly byId: Map<string, DocChunk>,
    private readonly embedder: OptionalEmbedder,
    private readonly queryEmbedDeadlineMs: number,
  ) {}

  /**
   * Build an index over `chunks`. When `embedder` is supplied, each chunk is embedded and the vector
   * leg is populated (hybrid retrieval); otherwise only the FTS5 floor is built. Async because
   * embedding is a (potentially network) call behind the seam. `embedPhaseDeadlineMs` bounds the
   * WHOLE embedding phase regardless of chunk count (default `DEFAULT_EMBED_PHASE_DEADLINE_MS`);
   * tests pass a tiny value to exercise the degrade path without a real wait.
   */
  static async build(
    chunks: DocChunk[],
    embedder?: Embedder,
    opts?: { embedPhaseDeadlineMs?: number; queryEmbedDeadlineMs?: number },
  ): Promise<DocsIndex> {
    const dim = embedder?.dim ?? FTS_FLOOR_DIM;
    const store = LocalStore.open({ dim });
    const byId = new Map<string, DocChunk>();
    const deadlineAt =
      Date.now() +
      (opts?.embedPhaseDeadlineMs ?? DEFAULT_EMBED_PHASE_DEADLINE_MS);
    // Embed with bounded concurrency so a 100+ chunk corpus boots in seconds (not minutes) against a
    // network embedder; with no embedder `embedOrSkip` is a no-op and this stays instant. The store
    // upserts run sequentially afterward (bun:sqlite is synchronous — no concurrent-writer hazard).
    let deadlineHit = false;
    const texts = chunks.map((chunk) => indexText(chunk));
    const embeddings = await mapPool(texts, EMBED_CONCURRENCY, async (text) => {
      if (Date.now() >= deadlineAt) {
        deadlineHit = true;
        return undefined; // phase deadline already passed — skip the network call entirely
      }
      try {
        const result = await raceDeadline(
          embedOrSkip(embedder, text),
          deadlineAt,
        );
        if (result === EMBED_DEADLINE) {
          deadlineHit = true;
          return undefined; // deadline passed mid-attempt (e.g. a long provider backoff) — FTS-only
        }
        return result;
      } catch {
        // One transient embed failure must NOT collapse the whole vector leg: this chunk stays
        // FTS-only (no vector) while every other chunk keeps its semantic coverage.
        return undefined;
      }
    });
    if (deadlineHit) {
      const embedded = embeddings.filter((e) => e !== undefined).length;
      process.stderr.write(
        `[service-docs] embed-phase deadline hit — ${String(embedded)}/${String(chunks.length)} chunks got a real embedding, the rest are FTS-only\n`,
      );
    }
    chunks.forEach((chunk, i) => {
      const embedding = embeddings[i];
      store.upsert({
        id: chunk.id,
        text: texts[i] ?? indexText(chunk),
        ...(embedding !== undefined ? { embedding } : {}),
      });
      byId.set(chunk.id, chunk);
    });
    return new DocsIndex(
      store,
      byId,
      embedder,
      opts?.queryEmbedDeadlineMs ?? DEFAULT_QUERY_EMBED_DEADLINE_MS,
    );
  }

  /** Retrieve the top-`k` chunks for `query`, fused across the FTS and (when wired) vector legs,
   *  with at most `perSourceCap` chunks per source document in the window (CAISSON-83). */
  async search(
    query: string,
    k = 5,
    tuning?: SearchTuning,
  ): Promise<ScoredChunk[]> {
    let queryVector: number[] | undefined;
    try {
      // Deadline-raced (battery-v2 fix): a SLOW query embed — the provider's own retry/backoff can
      // run minutes — degrades to the FTS floor exactly like a FAILING one, instead of holding the
      // request open past every caller's budget. The abandoned call keeps running in the
      // background (raceDeadline attaches its rejection handler), its result discarded.
      const raced = await raceDeadline(
        embedOrSkip(this.embedder, query),
        Date.now() + this.queryEmbedDeadlineMs,
      );
      if (raced === EMBED_DEADLINE) {
        process.stderr.write(
          "[service-docs] query-embed deadline hit — serving this query on the FTS floor\n",
        );
        queryVector = undefined;
      } else {
        queryVector = raced;
      }
    } catch {
      // A provider blip on the query embed degrades THIS query to the FTS floor rather than 500ing.
      queryVector = undefined;
    }
    const ftsWeight = tuning?.ftsWeight ?? DEFAULT_FTS_WEIGHT;
    const perSourceCap = tuning?.perSourceCap ?? DEFAULT_PER_SOURCE_CAP;
    // Over-fetch so the per-source cap has surplus candidates to promote into freed window slots.
    const hits = this.store.hybridSearch({
      queryText: query,
      limit: k * SEARCH_OVERFETCH,
      ftsWeight,
      ...(queryVector !== undefined ? { queryVector } : {}),
    });
    const out: ScoredChunk[] = [];
    const perSource = new Map<string, number>();
    for (const hit of hits) {
      if (out.length >= k) break;
      const chunk = this.byId.get(hit.id);
      if (!chunk) continue;
      const used = perSource.get(chunk.source) ?? 0;
      if (used >= perSourceCap) continue; // window slot goes to a distinct page instead
      perSource.set(chunk.source, used + 1);
      out.push({ ...chunk, score: hit.score });
    }
    return out;
  }

  /** Number of indexed chunks. */
  get size(): number {
    return this.byId.size;
  }

  close(): void {
    this.store.close();
  }
}
