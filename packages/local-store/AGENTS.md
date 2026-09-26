# AGENTS — @caisson-sh/local-store

Agent-facing authoring/usage contract (ADR-0020 `agents`). What a generation agent or a downstream
edition must know to wire the local store correctly.

## Invariants (do not violate)

- **Engine-neutral.** This package imports NO vendor SDK and runs NO LLM or embedding model. It is the
  store / fuse / isolation **mechanism** only. The embedding that produces a query/doc vector is an
  **injected seam** the consuming edition wires — pass the vector in; never compute it here.
- **Down-only (ADR-0022).** `@caisson-sh/local-store` is `kind: base`; it may be consumed by the
  Local-first and Agentic-Dev bundles (and base), but it MUST NEVER import a bundle. Each bundle
  composes this store as a pinned primitive.
- **Dimension is fixed at table creation.** `LocalStore.open({ dim })` creates `vec0(... FLOAT[dim])`.
  Indexing an embedding whose length ≠ `dim` THROWS — do not silently pad/truncate (flag-never-guess).
- **FTS5 is the always-available floor.** Retrieval never hard-depends on the vector leg: with no query
  vector — or a missing/failed vec leg — `hybridSearch` degrades to FTS5-only and still returns. A
  query vector of the wrong dimension is an explicit caller error and THROWS.
- **Tenant isolation is the file path.** The local/SQLite tier has no RLS. `tenantDbPath` / `openTenantDb`
  enforce one DB file per tenant. The `tenant_id → path` map is a **trusted server-side seam** — the
  `tenantId` comes from an authenticated context, NEVER raw user input. The resolver still guards:
  reject `..` / null bytes / absolute ids, `path.resolve` + assert the result is under the tenant-data
  root + `path.sep`. A cross-tenant query must remain inexpressible (separate connections, separate files).

## Retrieval (ADR-0067)

`hybridSearch({ queryText, queryVector?, limit? })` ranks each leg independently and fuses by
**Reciprocal Rank Fusion**: for a document appearing at 1-based rank `r` in a leg, that leg contributes
`1 / (RRF_K + r)` with `RRF_K = 60`; the fused score is the sum over the legs the document appears in.
Results are ordered by fused score descending (deterministic tie-break by document id). The vec leg is
skipped when no `queryVector` is given and is caught-and-skipped on a backend failure; the FTS leg runs
whenever `queryText` is non-empty. The canonical fused ordering is golden-pinned at
`src/__golden__/rrf-ranking.json`.

The fusion arithmetic itself lives in `src/rrf.ts` (`fuseByRrf`) — pure, database-free, and the ONE
implementation `hybridSearch` fuses its two legs through. Never re-derive the formula at a call
site. It is also the whole of the `./browser` entry point: a client bundle imports `./browser` for
`fuseByRrf`/`RRF_K` and never `.`. A module joins `./browser` only if its whole value graph passes
the package's static source-graph walk (`src/browser-safety.test.ts`) — which no module touching
`bun:sqlite` or `sqlite-vec` ever will — and every `./browser` name must also exist on `.`.

## Isolation (ADR-0073)

One SQLite DB file per tenant — the resolved path is the boundary, so a cross-tenant read is not even
expressible. Field-crypto keys stay per-tenant-derived (ADR-0043) and at-rest AEAD (ADR-0045) so an
exfiltrated file leaks no plaintext. "Encryption boundary == RLS boundary" holds per tier: RLS on
Postgres, file separation on local.

## Golden (ADR-0013)

`src/__golden__/rrf-ranking.json` (the canonical fused ranking for a fixed `(vectors, FTS docs, query)`
input). Deterministic — no clocks, randomness, or env. Update only via `BLESS=1 bun test`, landing as a
reviewable diff.

## Out of scope

No embedding model, no provider SDK, no agent loop, no Postgres/RLS (that is `@caisson-sh/tenancy-rls`).
This store is the primitive the local editions compose; the embedding wiring and curated content live in
the edition.
