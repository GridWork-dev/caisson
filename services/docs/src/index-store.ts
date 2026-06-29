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

/** Index text = title + section + body, so heading/title terms strengthen the FTS (bm25) leg. */
function indexText(chunk: DocChunk): string {
  return [chunk.title, chunk.section, chunk.text]
    .filter((s) => s.length > 0)
    .join("\n");
}

export class DocsIndex {
  private constructor(
    private readonly store: LocalStore,
    private readonly byId: Map<string, DocChunk>,
    private readonly embedder: OptionalEmbedder,
  ) {}

  /**
   * Build an index over `chunks`. When `embedder` is supplied, each chunk is embedded and the vector
   * leg is populated (hybrid retrieval); otherwise only the FTS5 floor is built. Async because
   * embedding is a (potentially network) call behind the seam.
   */
  static async build(
    chunks: DocChunk[],
    embedder?: Embedder,
  ): Promise<DocsIndex> {
    const dim = embedder?.dim ?? FTS_FLOOR_DIM;
    const store = LocalStore.open({ dim });
    const byId = new Map<string, DocChunk>();
    for (const chunk of chunks) {
      const embedding = await embedOrSkip(embedder, indexText(chunk));
      store.upsert({
        id: chunk.id,
        text: indexText(chunk),
        ...(embedding !== undefined ? { embedding } : {}),
      });
      byId.set(chunk.id, chunk);
    }
    return new DocsIndex(store, byId, embedder);
  }

  /** Retrieve the top-`k` chunks for `query`, fused across the FTS and (when wired) vector legs. */
  async search(query: string, k = 5): Promise<ScoredChunk[]> {
    const queryVector = await embedOrSkip(this.embedder, query);
    const hits = this.store.hybridSearch({
      queryText: query,
      limit: k,
      ...(queryVector !== undefined ? { queryVector } : {}),
    });
    const out: ScoredChunk[] = [];
    for (const hit of hits) {
      const chunk = this.byId.get(hit.id);
      if (chunk) out.push({ ...chunk, score: hit.score });
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
