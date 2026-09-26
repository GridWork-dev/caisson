# @caisson-sh/local-store

The shared **local hybrid-retrieval** primitive — sqlite-vec (`vec0`) for vectors, FTS5 for
keyword, and a Reciprocal-Rank-Fusion merge over the two — that both local-editions compose
without ever depending on one another.

Placed in base because the Local-first AI edition (its canonical/vector store) and the
Agentic-Dev edition (its local hybrid memory) both need the same primitive, and a base
package never imports an edition or another edition's package.

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

## Entry points

- `.` — the full surface: the store, the tenant-file resolver, the embedder port, the egress guard,
  and retention GC.
- `./browser` — the browser-safe subset: `fuseByRrf` and `RRF_K`, the fusion arithmetic with no
  database attached. Fuse leg rankings a server or worker already produced, inside a client bundle.
  Retrieval itself cannot come along — the `vec0` KNN and FTS5 legs need `bun:sqlite` plus the
  `sqlite-vec` native extension. Every name on `./browser` is also on `.`.
- `./ui` — the React search component.

## Engine-neutral (binding)

No vendor SDK import. Does NOT run an LLM or compute an embedding. The package contributes the
store/fuse/isolation **mechanism**; the consuming edition contributes the embedding wiring and the
curated content.

## Use

```ts
import {
  LocalStore,
  openTenantDb,
  tenantDbPath,
} from "@caisson-sh/local-store";

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

## macOS note

macOS ships a system SQLite with extension loading disabled, so a bare `bun:sqlite`
`loadExtension(sqlite-vec)` throws. Point `bun:sqlite` at an extension-capable build — Homebrew's
SQLite supports it — before opening a store; see `src/store.ts` for the detection logic.
