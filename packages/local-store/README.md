# @caisson/local-store

> **macOS CI note (2026-07-02):** the `native-ext` macOS leg runs on the fleet's Mac mini runner
> (`[self-hosted, gw-macos-arm64]`). The extension-capable Homebrew SQLite it needs is provisioned
> host-wide at `/opt/homebrew/opt/sqlite` (the first `setCustomSQLite` candidate in `src/store.ts`);
> the CI step is check-first and only `brew install`s when the dylib is missing (hosted runners).

The shared **local hybrid-retrieval** base — sqlite-vec (`vec0`) for vectors, FTS5 for keyword, and a
Reciprocal-Rank-Fusion merge over the two — that both local editions compose down-only. ADR-0067 (base
placement) · ADR-0073 (file-per-tenant isolation) · ADR-0022 (down-only) · ADR-0003 (composable, never a
fork) · ADR-0002 (strict + Zod boundary).

Extracted to base BECAUSE the Local-first AI edition (its canonical/vector store) AND the Agentic-Dev
edition (its local hybrid memory) need the same primitive; placed inside one edition, a base→edition or
edition→edition import fails the ADR-0022 down-only gate. With local-ai now fully commercial (ADR-0050),
the former AGPL-consumes-commercial combined-work concern that blocked a shared store is moot — this is a
clean single-license base dependency.

## What it gives you

- **Hybrid retrieval (`hybridSearch`).** Rank by vector KNN (`vec0` `FLOAT[N]`, dimension fixed at table
  creation) and by FTS5 independently, then fuse with **RRF (`RRF_K = 60`)**. The **FTS5 path is always
  available**; when no query vector is supplied — or the vec leg is missing/fails — retrieval **degrades
  to FTS5-only** and still returns results. A dimension mismatch on an indexed embedding **throws**
  (flag-never-guess).
- **Embedding is an injected seam.** This package never calls an embedding model. The consuming edition
  computes the query/doc vector and passes it in — `local-store` only stores and fuses, so it is
  network-free and deterministic (golden-pinned at `src/__golden__/rrf-ranking.json`).
- **File-per-tenant isolation floor (`tenantDbPath` / `openTenantDb`).** The local/SQLite tier has no
  RLS; isolation is **one DB file per tenant** — the resolved path IS the boundary, so a cross-tenant
  query is not even expressible. The resolver rejects `..` / null-byte / absolute ids and asserts the
  resolved path stays under the tenant-data root (ADR-0073).

## Engine-neutral (binding)

No vendor SDK import. Does NOT run an LLM or compute an embedding. The package contributes the
store/fuse/isolation **mechanism**; the consuming edition contributes the embedding wiring and the
curated content.

## Use

```ts
import { LocalStore, openTenantDb, tenantDbPath } from "@caisson/local-store";

// Per-tenant file is the isolation boundary (tenantId comes from authenticated context).
const db = openTenantDb("/var/lib/caisson/tenants", tenantId);

const store = LocalStore.open({ dim: 3 }); // dimension fixed at table creation
store.upsert({
  id: "a",
  text: "the quick brown fox",
  embedding: [0.9, 0.1, 0.0],
});
store.upsert({ id: "b", text: "lazy dog sleeps" }); // FTS-only doc (no embedding)

// Hybrid (both legs); omit queryVector to take the always-available FTS5-only path.
const hits = store.hybridSearch({
  queryText: "fox",
  queryVector: [1, 0, 0],
  limit: 10,
});
```

## Tests

`bun test packages/local-store/src` — the RRF ranking matches its golden; with the vec leg removed it
degrades to FTS5-only and still returns; a dimension mismatch throws; a traversal/null/absolute tenant
id is rejected before any open and two tenants resolve to distinct files. Golden fixtures live in
`src/__golden__`; update only via `BLESS=1` (ADR-0013).

> Rebuilt clean from the PUBLIC gridwork-core `memory-vec.ts` `hybridSearch` pattern (RRF_K=60, vec0 +
> FTS5 + degrade). No pro-private `media-pipeline` code — patterns only.

**macOS CI note (2026-07-02):** the `native-ext` macOS leg runs on the fleets
