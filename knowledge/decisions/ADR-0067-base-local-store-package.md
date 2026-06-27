# ADR-0067 — New base package @caisson/local-store (vec + FTS + RRF)

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Extracts the shared hybrid-retrieval
primitive both P4 editions need, now that ADR-0050 removed the AGPL gate.)

The Local-first AI edition and the Agentic-Dev edition both need the same local store: sqlite-vec
(vec0) for vectors, FTS5 for keyword, and a reciprocal-rank-fusion hybrid merge over the two. While
local-ai shipped `AGPL-3.0-only` (ADR-0023), one shared base package was schema- and legally-fraught —
the manifest's AGPL⟺local-ai refine forbade a non-local-ai AGPL package, and AGPL copyleft running
downward over a commercial base made a shared commercial primitive a combined-work hazard. ADR-0050
made local-ai fully-commercial, dissolving that bind.

## Decision

**The sqlite-vec + FTS5 + RRF-hybrid local-store primitive is extracted into one NEW base package,
`@caisson/local-store`**, that both P4 editions compose.

- **Both editions consume it down-only.** The Local-first AI edition (its canonical/vector store) AND
  the Agentic-Dev edition (its local hybrid memory layer) depend on `@caisson/local-store`; it never
  depends up on an edition (ADR-0003 / ADR-0022 down-only gate).
- **DRY extraction is enabled by ADR-0050.** With local-ai now `LicenseRef-Caisson-Commercial` like
  every package, the former AGPL-consumes-commercial combined-work concern is **moot** — this is a
  clean, single-license base dependency. No AGPL manifest refine to dodge, no copyleft-downward legal
  gate, no per-edition vendored copy.
- **Uniform licensing** (ADR-0050/0023): `tier: paid`, `license: LicenseRef-Caisson-Commercial`.
- **Surface** — raw `bun:sqlite` over `vec0` (FLOAT[N], dimension fixed at table creation) + FTS5,
  with an always-available FTS path and an RRF merge (RRF_K=60) when embeddings exist, degrading to
  FTS5-only on a missing/failed vec leg. Rebuilt clean from the proven gridwork-core `memory-vec.ts`
  `hybridSearch` seed (patterns only; pro-private firewall holds). Inference/embedding stays a seam
  the consuming edition wires.

## Rejected

- **Duplicating the vec+FTS+RRF stack per edition** — two copies that drift, double the native-
  extension CI matrix and the SQLite-migration discipline, and re-litigate the same hybrid-merge
  policy twice. The pre-0050 lean (vendor AGPL copies into each edition) existed only to satisfy the
  AGPL manifest refine — mooted by ADR-0050, so the clean shared package wins.
- **agent-dev memory as a thin client over a buyer-provided store** — pushes the store problem onto
  the buyer, weakens the turnkey out-of-box retrieval demo, and forfeits the "runs fully offline"
  exit headline. Rejected: the edition owns its store via the shared base.

## Binding

All hybrid local retrieval (sqlite-vec + FTS5 + RRF) lives in exactly one base package,
`@caisson/local-store`; both P4 editions compose it down-only and neither forks its own copy nor
inverts the dependency; it ships `tier: paid` / `LicenseRef-Caisson-Commercial` like every package;
future code and agents may not re-duplicate the stack or re-carve an AGPL flank for it without
superseding this ADR. Evidence: ADR-0050 (local-ai fully-commercial — removes the AGPL refine +
combined-work gate that blocked DRY extraction), ADR-0023 (uniform commercial model), ADR-0003 (an
edition is a composition, a package never depends up), ADR-0022 (down-only / boundary gates), ADR-0020
(manifest `tier`/`license`); gridwork-core `tools/lib/memory-vec.ts` (`hybridSearch` RRF_K=60, vec0
FLOAT[1024], FTS5→degrade seed); `tooling/` + `registry/` standards seam; research artifact
`outputs/research/wave1-forks.md` (P4a memory fork — shared sqlite-vec/FTS store wanted by both
editions).
