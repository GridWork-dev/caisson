# PLAN — Wave 1 · P4a: Local-first AI edition

Act 2 (PLAN) for `outputs/specs/wave1-p4a-local-ai/SPEC.md`. Atomic tasks, one commit each, in
dependency order. Every task lists its verify command(s); iterate to green before committing. Routing
per `identity/doctrine.md`: bounded <~300-LOC scoped impl → **gw-typescript-pro/sonnet**;
context-bearing cross-package wiring/design → **opus main-thread**; license/scaffold/docs → **haiku**.

**Hard rules baked into every task:** TypeScript strict · Bun runtime/PM (never npm/yarn) · Zod
`.strict()` at every boundary · no `any` / no `console.log` in product code · integer credits ·
`crypto.randomUUID()` IDs · `fetchWithTimeout` on every outbound fetch · `crypto.timingSafeEqual` for
secret compares (asymmetric license verify uses `crypto.verify`, ADR-0010) · fail-closed · NO live
cloud/model/network in CI (InferenceBackend stubbed, sync transport test-doubled, model-fetch never
exercised) · pro-private firewall (PUBLIC tessera + health-service patterns ONLY, never
`media-pipeline`) · every new package ships through `tooling/` (manifest + golden + AGENTS.md +
down-only depcruise entry, ADR-0020/0022) · golden BEFORE logic (ADR-0013).

## Build order rationale

`@caisson/local-store` (the shared base + literal exit-gate primitive) and `@caisson/license-verify`
(a kernel-only leaf) are independent → build in parallel isolated worktrees. The edition
`@caisson/local-ai` (T9+) cannot compose until both base manifests are green. **The two-way sync chain
(T15→T19) is the critical path** — the heaviest single build — and is decomposed into changeset
capture → conflict goldens → LWW/CRDT merge → tombstones → convergence integration test. The app (T22)
composes the finished edition. Golden-before-logic pairs: **T3→T4**, **T6→T7**, **T16→T17**.

## Tasks

### T1 — local-ai license flip → fully-commercial (ADR-0050) · scope `local-ai`

- `packages/local-ai/package.json`: `license` `AGPL-3.0-only` → `LicenseRef-Caisson-Commercial`;
  drop "AGPL" + "ANN" from the description (sqlite-vec is brute-force KNN, not graph-ANN). README note.
- **Verify:** `bun run gate` (no `agpl-boundary` finding for local-ai). **Routing:** haiku.

### `@caisson/local-store` (NEW base primitive — ADR-0067) · scope `local-ai`

### T2 — local-store scaffold + bun:sqlite store + SQLite migration analog

- `packages/local-store/{package.json, tsconfig.json, eslint.config.js}` (dev `@caisson/{tsconfig,
eslint-config,testing}`; dep `@caisson/kernel`). `src/store.ts` (open `bun:sqlite`, `loadExtension`
  sqlite-vec, WAL pragmas). `src/migrate.ts` (health-service analog: `CREATE TABLE IF NOT EXISTS` +
  a `schema_version` row; **the vec0 `FLOAT[DIM]` dim is fixed at table creation — irreversible**).
  `src/schema.ts` (vec0 table + FTS5 table + an `items` relational table, `crypto.randomUUID()` PKs).
- **Verify:** `bun test packages/local-store/src/store.test.ts` (open/migrate/idempotent-reapply);
  `bun run check`. **Routing:** gw-typescript-pro/sonnet. **Depends:** kernel (exists).

### T3 — local-store hybrid GOLDEN fixtures + failing test (golden-before-logic, ADR-0013)

- `src/__golden__/{hybrid-rrf.json, fts-only.json}` (hand-derived expected order for a fixed
  embedding+FTS fixture); `src/hybrid.test.ts` asserts RRF order on the vec+FTS fixture and the
  FTS-only degrade path. RED until T4.
- **Verify:** `bun test packages/local-store/src/hybrid.test.ts` fails as expected. **Routing:** sonnet.

### T4 — local-store hybrid retrieval logic (vec0 KNN + FTS5 + RRF merge)

- `src/rrf.ts` (RRF_K=60 reciprocal-rank fusion); `src/hybrid.ts` (`hybridSearch`: vec0 KNN +
  FTS5 `MATCH`, merge via RRF when embeddings exist; **dim-guard** `queryVector.length === DIM`;
  catch-falls-back-to-FTS on a missing/failed vec leg). `src/index.ts` exports.
- **Verify:** `bun test packages/local-store/src` green incl. goldens with `BLESS` unset. **Routing:**
  sonnet. **Depends:** T2, T3.

### T5 — local-store manifest + AGENTS.md + depcruise + native-ext CI matrix

- `manifest.ts` (`defineModule`, `kind:"primitive"`, `tier:"paid"`, `priceCents` PLACEHOLDER pending
  the open Pricing lock, `LicenseRef-Caisson-Commercial`, `golden:"src/__golden__"`, dep
  `@caisson/kernel`); `AGENTS.md`; `README.md`; a down-only `.dependency-cruiser.cjs` entry; a
  `.github/workflows/ci.yml` macOS+Linux matrix note for the native `sqlite-vec` extension.
- **Verify:** `bun run gate` green (manifest↔package.json agreement); `bunx eslint
packages/local-store` + depcruise 0. **Routing:** sonnet. **Depends:** T2–T4.

### `@caisson/license-verify` (NEW base primitive — ADR-0010, fork P4a-10) · scope `license`

### T6 — token codec + signed-token KAT GOLDEN first (golden-before-logic)

- `packages/license-verify/{package.json, configs}` (dep `@caisson/kernel`). `src/token.ts` (codec
  for `PREFIX-TIER-base64url(payload+sig)`, compact deterministic JSON — tessera format verbatim).
  `src/__golden__/signed-token.json`; `src/token.test.ts` (encode/decode round-trip KAT). RED until T7.
- **Verify:** `bun test packages/license-verify/src/token.test.ts` (codec passes; verify path RED).
  **Routing:** sonnet. **Depends:** kernel.

### T7 — offline Ed25519 verify logic + claims schema

- `src/claims.ts` (Zod `.strict()` `entitlements[]+tier+expiry`, perpetual-per-major). `src/verify.ts`
  (`crypto.verify` Ed25519 over kernel `canonicalize(payload)`; baked-in public key; **signed tier is
  authority, prefix cosmetic**; never raises — fail-safe-to-community on tamper/absent/expired).
  `src/index.ts`.
- **Verify:** `bun test packages/license-verify/src` green incl. KAT golden; tamper→community,
  absent→community, valid→tier. **Routing:** sonnet. **Depends:** T6.

### T8 — license-verify manifest + AGENTS.md + depcruise

- `manifest.ts` (`kind:"primitive"`, `tier:"paid"`, placeholder `priceCents`,
  `LicenseRef-Caisson-Commercial`, `golden:"src/__golden__"`, dep `@caisson/kernel`); `AGENTS.md`;
  `README.md`; depcruise entry.
- **Verify:** `bun run gate` green; eslint + depcruise 0. **Routing:** sonnet. **Depends:** T6, T7.

### `@caisson/local-ai` (EDITION composition) · scope `local-ai`

### T9 — edition scaffold + manifest + compose the bases

- `src/index.ts`; `manifest.ts` (`kind:"edition"`, `editions:["local-ai"]`, `tier:"paid"`,
  placeholder `priceCents`, `LicenseRef-Caisson-Commercial`, deps `[@caisson/kernel,
@caisson/local-store, @caisson/license-verify, @caisson/field-crypto]`); `package.json` deps;
  `AGENTS.md`; down-only depcruise entry (edition→base only).
- **Verify:** `bun run gate` (down-only holds, no base→edition edge); depcruise 0. **Routing:** opus
  main-thread (cross-package graph). **Depends:** T5, T8, field-crypto (exists).

### T10 — file-per-tenant resolver (ADR-0073) — security threat TM-ISO

- `src/tenancy/tenant-path.ts` (`tenant_id → file path`; reject `..`/null bytes; `path.resolve` +
  assert result under the tenant-data root + `path.sep`; `tenant_id` never user-supplied).
  `src/tenancy/tenant-path.test.ts` (traversal rejected; absolute-path rejected; resolved path stays
  under root).
- **Verify:** `bun test packages/local-ai/src/tenancy`. **Routing:** sonnet. **Depends:** T9.

### T11 — at-rest field-crypto composition over the local store (ADR-0055/0064) — security threat TM-REST

- `src/crypto/at-rest.ts` (a local `DerivedKeyProvider` from a local-deployment master-key source;
  `sealField`/`openField` sensitive columns; `tenant_id` bound into HKDF `info`; per-tenant-derived).
  `src/crypto/at-rest.integration.test.ts` (round-trip; a tenant-B file cannot open a tenant-A
  ciphertext → auth-fail).
- **Verify:** `bun test packages/local-ai/src/crypto`. **Routing:** sonnet. **Depends:** T9, T10.

### T12 — InferenceBackend port + CI stub (ADR-0064: no live model in CI)

- `src/inference/backend.ts` (`InferenceBackend` port: `embed(text) → Float32Array` of the locked
  DIM; `complete(...)` seam). `src/inference/stub.ts` (deterministic fake embeddings for tests).
  `src/inference/backend.test.ts`.
- **Verify:** `bun test packages/local-ai/src/inference/backend.test.ts`. **Routing:** sonnet.
  **Depends:** T9.

### T13 — real local embedding backend behind the port (NOT exercised in CI)

- `src/inference/onnx-backend.ts` (transformers.js/onnxruntime; model **first-run-fetched, cached, NOT
  in the tarball**; hash-pinned integrity; the fetch host is a sanctioned egress sink declared to the
  privacy gate). `.npmignore`; README note. No test makes a live call.
- **Verify:** `bun run check`; eslint (no raw `fetch`; outbound only via the guarded kernel helper).
  **Routing:** sonnet. **Depends:** T12.

### T14 — privacy gate / egress guard (fork P4a-7-D) — security threat TM-EGRESS

- `src/privacy/policy.ts` (Zod `.strict()` allowlist + `privacy:"local-only"`); `src/privacy/egress-
guard.ts` (wrap `fetchWithTimeout`; hard-block any non-allowlisted host; empty allowlist = zero
  egress; **fail-closed-to-offline — no silent fallback to a hosted provider**; sanctioned sinks =
  the model-fetch host + the rented-backend host only). `src/privacy/egress-guard.test.ts`.
- **Verify:** `bun test packages/local-ai/src/privacy`. **Routing:** sonnet. **Depends:** T9.

### T15 — SyncEngine port + changeset capture (SQLite session/changeset ext) — data-migration

- `src/sync/port.ts` (`SyncEngine`: `capture`/`apply`/`reconcile`). `src/sync/changeset.ts` (record
  per-tenant changesets via the session extension; canonical store is authority). `src/sync/
changeset.test.ts`. Sync-metadata columns are migration-versioned (irreversible — see T21).
- **Verify:** `bun test packages/local-ai/src/sync/changeset.test.ts`. **Routing:** sonnet.
  **Depends:** T9. _(Critical path start.)_

### T16 — reconcile CONFLICT GOLDEN fixtures + failing test (golden-before-logic)

- `src/sync/__golden__/{lww-resolve.json, tombstone-resolve.json}` (two divergent replicas → expected
  converged state); `src/sync/reconcile.test.ts`. RED until T17.
- **Verify:** `bun test packages/local-ai/src/sync/reconcile.test.ts` fails as expected. **Routing:**
  sonnet. **Depends:** T15.

### T17 — LWW/CRDT merge logic

- `src/sync/clock.ts` (hybrid logical clock; deterministic tiebreak — no forgeable wall clock).
  `src/sync/reconcile.ts` (last-writer-wins per field; the local canonical store is the convergence
  target). Make T16's lww golden pass.
- **Verify:** `bun test packages/local-ai/src/sync` green incl. lww golden. **Routing:** sonnet.
  **Depends:** T15, T16.

### T18 — tombstones (deletes propagate; no resurrection; GC after horizon)

- `src/sync/tombstone.ts`; `src/sync/tombstone.test.ts` (a delete on replica A is not resurrected by
  a stale A→B edit; tombstone GC past the horizon). Make the tombstone golden pass.
- **Verify:** `bun test packages/local-ai/src/sync` green incl. tombstone golden. **Routing:** sonnet.
  **Depends:** T17.

### T19 — two-way sync convergence INTEGRATION test (test-doubled transport) — EXIT GATE

- `src/sync/convergence.integration.test.ts` — two in-process SQLite replicas, no real network:
  concurrent per-field edits + a delete → both replicas converge byte-equal on the synced tables after
  a round-trip; deterministic; the local store is authority.
- **Verify:** `bun test packages/local-ai/src/sync` green (the SPEC exit-gate clause 2). **Routing:**
  sonnet. **Depends:** T18.

### T20 — rented/hosted inference backend SEAM + metered-call shape (fork P4a-15-C)

- `src/inference/rented-backend.ts` (port + metered-call shape; `// P6:` live `credits.debit` over the
  append-only/integer/idempotent ledger — wiring deferred to P6 commerce; off by default, egress gated
  by the privacy gate). `src/inference/rented-backend.test.ts` (shape only, no network).
- **Verify:** `bun test packages/local-ai/src/inference/rented-backend.test.ts`. **Routing:** sonnet.
  **Depends:** T12, T14.

### T21 — edition migration assembly + schema_version ledger — data-migration

- `src/store/migrate.ts` composes local-store's retrieval-table migration + the edition tables (items,
  at-rest columns, sync metadata) under one ordered, idempotent `schema_version` ledger; **document the
  irreversible vec0 dim-lock + sync-metadata columns** (no rollback past them). `src/store/migrate.test.ts`.
- **Verify:** `bun test packages/local-ai/src/store` (apply is idempotent; re-apply is a no-op).
  **Routing:** sonnet. **Depends:** T11, T15.

### `apps/local-ai` (reference app — ADR-0044) · scope `local-ai`

### T22 — Next.js localhost reference app (the P4a exit artifact)

- `apps/local-ai/{app/, package.json (LicenseRef-Caisson-Commercial), next config}`. Route handlers /
  RSC over `bun:sqlite` + the edition: seed two tenant files → write an at-rest-encrypted field →
  hybrid-retrieve offline → verify the offline license → demo a two-replica sync convergence. A
  one-line reconciliation note for the `specs/01:43-44` "hosted inference, no local models" doc-tension
  (that governs the seller platform, not this edition).
- **Verify:** `bun run check`; app builds; the demo route returns hybrid results with zero egress.
  **Routing:** opus main-thread (cross-package wiring). **Depends:** T9–T21.

### T23 — full-repo green + VERIFY / SWEEP / EVAL / SHIP

- **Verify:** `bun install` clean; `bun run check` green; `bun test` green repo-wide incl. the sync
  convergence integration test, the hybrid + FTS-only goldens, the license KAT, the at-rest isolation
  test, the egress-block test; all goldens matched with `BLESS` unset; `bun run gate` + depcruise 0;
  the CI macOS+Linux matrix loads the native `sqlite-vec` ext. EVAL (ai tag) over the retrieval/
  inference surface; no service restarted (no DEPLOY). **Routing:** opus main-thread.

## Dependency notes

- **Parallel isolated-worktree writers:** `@caisson/local-store` (T2–T5) and `@caisson/license-verify`
  (T6–T8) share no files → two worktrees (`gw start --wt`). Inside the edition, T10/T12/T14 touch
  disjoint dirs and can parallelize once T9 lands; the **sync chain T15→T16→T17→T18→T19 is strictly
  serial** and is the critical path.
- **Shared-base ordering:** T9 (edition compose) blocks on T5 + T8 (both base manifests green) and on
  the existing Wave-0 `@caisson/field-crypto`. T11 (at-rest) blocks on field-crypto + T10.
- **Golden-before-logic (ADR-0013):** T3 precedes T4 (hybrid), T6 precedes T7 (token verify), T16
  precedes T17 (reconcile); T18's tombstone golden is authored in-task before its logic passes.
- **Critical-path dependency:** `@caisson/local-store` T4 (hybrid) → edition T9 → the sync chain
  T15→T19 → app T22 → T23. The two-way sync engine (T15–T19) is the longest pole.

## Threats to model (drives the SHIP SECURITY audit — tags `security` / `data-migration`)

| #         | Threat                                                                          | Mitigation (asserted in code/test)                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TM-EGRESS | A raw `fetch` bypasses the privacy gate → data leaves the device                | All outbound routes through the guarded kernel `fetchWithTimeout`; non-allowlisted host hard-blocked; empty allowlist = zero egress; fail-closed-to-offline, no silent hosted fallback; eslint bans raw `fetch` (T14) |
| TM-MODEL  | The first-run model fetch is an unsanctioned / un-integrity-checked egress sink | The fetch host is an explicit privacy-gate allowlist entry; the model is hash-pinned; air-gap buyers pre-seed the cache (T13)                                                                                         |
| TM-ISO    | Cross-tenant data access via the `tenant_id → path` map                         | File-per-tenant (ADR-0073): `path.resolve` + assert under the tenant-data root + `path.sep`; reject `..`/null bytes/absolute; `tenant_id` server-derived, never user-supplied (T10)                                   |
| TM-REST   | An exfiltrated SQLite file leaks plaintext                                      | At-rest field-crypto: per-tenant-derived key, AEAD envelope; tenant-B file cannot open tenant-A ciphertext; local master key read once, never logged (T11)                                                            |
| TM-LIC    | Forged/replayed license unlocks paid tier                                       | Ed25519 `crypto.verify` over canonical payload, baked-in public key; signed tier is authority (prefix cosmetic); verify never raises, fail-safe-to-community (T7)                                                     |
| TM-SYNC   | A cross-tenant or rolled-back changeset corrupts a peer                         | Changesets are per-tenant-file partitioned (ADR-0073) — a tenant-A changeset cannot apply to a tenant-B file; hybrid-logical-clock tiebreak resists clock forgery; tombstones don't resurrect (T15–T19)               |
| TM-RENT   | The rented-backend path egresses while "offline" is promised                    | Rented backend off by default, gated by the privacy gate as a sanctioned opt-in sink; live debit + transport are P6 seams, not wired here (T20)                                                                       |

## Done-when

The SPEC §"Exit gate" — all six clauses green with run-and-read evidence, `BLESS` unset, `bun run
gate` + depcruise 0, the native-ext CI matrix green, PR open + CI green, no service restarted.
