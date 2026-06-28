# ADR-0064 — Local-first AI edition: built two-way sync, vector engine, inference runtime

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Implements P4a now that the
local-ai edition is fully-commercial under ADR-0050 — no AGPL constraints on what we build.)

The local-first edition promises an offline, no-lock-in AI stack over a single-file SQLite store,
which forces three hard architecture calls: how devices reconcile (sync), how vectors are searched,
and where inference runs. The research recommended a sync _seam_ only; the operator overrode it to
ship real two-way sync built in-house.

## Decision

Implement **P4a** — the local-first AI edition — over a canonical single-file-per-tenant SQLite
store. ADR-0050 makes this edition fully-commercial (superseding ADR-0023's AGPL flank for
local-first), so everything below is original, owned code under no copyleft obligation.

- **Two-way sync ships in v1, built in-house** (operator override of the seam-only recommendation,
  the heaviest single build in the wave): **CRDT / LWW reconciliation + tombstones** carried over the
  SQLite **Session/changeset** extension, behind a **`SyncEngine` port**. No vendor coupling; the
  design fits the single-file SQLite shape. **The local store is canonical** — sync converges peers
  toward it, never the reverse.
- **Vector engine = `sqlite-vec`** with a **locked embedding dimension** (changing it is a migration,
  not a config flip). Brute-force KNN is the v1 search; a **true-ANN engine is the documented upgrade
  path** if KNN doesn't scale — same swap-behind-a-seam ethos as the cipher port (ADR-0045).
- **Local inference runs behind an `InferenceBackend` port.** What ships REAL in v1 versus seam-only
  is scoped in the SPEC, not pre-bound here.
- **Hybrid retrieval is the literal exit gate:** `sqlite-vec` ANN/KNN **+ FTS5 keyword fallback**,
  merged via **Reciprocal Rank Fusion (RRF)**. The edition is not done until hybrid (RRF) search is green.
- **At-rest encryption of the local store reuses field-crypto** (ADR-0055) — no second crypto stack.
- **Tenant isolation = one SQLite DB file per tenant** (ADR-0073) — the canonical store and its sync
  changesets are physically partitioned per tenant.
- **CI/golden strategy handles non-determinism + native binaries:** golden fixtures for
  reconcile/RRF ordering, pinned native builds for `sqlite-vec`/FTS5, and **no live model calls in CI**
  — inference is stubbed at the `InferenceBackend` port.

## Rejected

- **Seam-only / no sync in v1** — ship a `SyncEngine` interface but no real reconciliation. The
  research's recommendation; the operator chose real two-way sync, because an offline edition whose
  marquee promise is multi-device that doesn't actually sync is a hollow demo.
- **Buy sync (Turso / PowerSync / cr-sqlite)** — vendor coupling plus live-durability risk: Realm is
  EOL, cr-sqlite's own guidance is "avoid in production." A hosted/managed sync dependency cuts
  directly against the offline, no-lock-in brand the edition is sold on.

## Binding

The local-first edition's sync, vector search, and inference are each addressed through a named port
(`SyncEngine`, vector engine, `InferenceBackend`); the canonical SQLite store is the single source of
truth that sync converges toward; vector dimension is locked and only migrated, never reconfigured;
hybrid `sqlite-vec` + FTS5 RRF merge is the completion gate; at-rest encryption is field-crypto
(ADR-0055), not a new primitive; and per-tenant isolation is one SQLite file per tenant (ADR-0073).
No managed/hosted sync service and no AGPL-encumbered sync library may be introduced — sync is
in-house, owned, and commercial. Evidence: ADR-0050 (local-ai fully-commercial), ADR-0055
(field-crypto at-rest reuse), ADR-0073 (one-DB-file-per-tenant), ADR-0045 (swap-behind-a-seam cipher
precedent), and the fork analysis in `outputs/research/wave1-forks.md`.
