# SPEC — Wave 1 · P4a: Local-first AI edition

Act 1 (SPEC) of the 7-act cycle for the P4a Local-first AI edition. Bound by the locked ADRs cited
below (do not relitigate). Research input: `outputs/research/wave1-forks.md` §"P4a-local-ai — 17
forks" (all RESOLVED 2026-06-27). Format reference: `outputs/specs/wave0-shared-substrate/`.

## Goal

Ship the **Local-first AI edition** — a fully-commercial (ADR-0050, no AGPL/copyleft anywhere),
offline, no-lock-in AI stack over a single-file-per-tenant SQLite store. It composes the shared base
`@caisson/local-store` (sqlite-vec + FTS5 + RRF hybrid retrieval) and adds: a **built two-way sync
engine** (CRDT/LWW + tombstones over the SQLite session/changeset extension behind a `SyncEngine`
port — the heaviest single build in the wave), an `InferenceBackend` port (real local embeddings,
completion seam-only, stubbed in CI), a runtime **privacy gate** (zero-egress-by-default), **offline
Ed25519 license verification**, **at-rest field-crypto reuse**, and **file-per-tenant** isolation.
WHY: the edition's marquee promise — multi-device, offline, "your data never leaves the device" — is
hollow if sync is a stub or egress is merely claimed; VERIFY re-asks whether the built stack actually
converges replicas, retrieves hybrid-offline, and enforces zero-egress.

## Tags

`ai` (the inference/embedding/retrieval surface — fires the EVAL act + UI/AI review) · `security`
(local at-rest crypto, the privacy/egress gate, offline license verify) · `data-migration` (the
SQLite migration analog + the **irreversible** vec0 embedding-dimension lock + sync-metadata columns).
Drives the SHIP conditional audits: **SECURITY audit** (security) + **EVAL** (ai) + **migration-safety

- rollback check** (data-migration). No `external-system` surface ships live — every cloud/model/sync
  path is test-doubled in CI.

## Scope

**Creates (3 packages + 1 app):**

1. **`@caisson/local-store`** — NEW shared base primitive (ADR-0067). Raw `bun:sqlite` over `vec0`
   (`FLOAT[N]`, dimension fixed at table creation) + FTS5, with an always-available FTS path and an
   **RRF merge (RRF_K=60)** when embeddings exist, degrading to FTS5-only on a missing/failed vec leg.
   Both P4 editions compose it down-only. Inference/embedding stays a seam the edition wires.
2. **`@caisson/license-verify`** — NEW base primitive: offline Ed25519 token verify (tessera format
   `PREFIX-TIER-base64url(payload+sig)` rebuilt clean from PUBLIC tessera), `crypto.verify` over kernel
   `canonicalize()`, baked-in public key, Caisson's richer `entitlements[]+tier+expiry` claims,
   fail-safe-to-community, perpetual-per-major. The issuer is P6; only offline verify lands here.
3. **`@caisson/local-ai`** — the EDITION (composition): `SyncEngine` port + the built two-way sync
   engine, the `InferenceBackend` port + a real local embedding backend + a CI stub, the privacy/egress
   gate, the file-per-tenant resolver, the at-rest field-crypto composition, the rented-backend seam,
   and the edition migration assembly. (Also flips the package license AGPL-3.0-only → commercial.)
4. **`apps/local-ai`** — Next.js App Router reference app (ADR-0044) running as a localhost server:
   offline hybrid retrieval + license verify + a live two-replica sync convergence demo.

**OUT of scope:** the license **issuer** + live credit debit for rented inference (P6 commerce); a
shipped desktop shell (Electron/Tauri are buyer-side compositions — the reference app is a localhost
Next server per ADR-0044/P4a-14-A); a local MCP server (P4a-17 — deferred, low-priority seam); a
true-ANN engine (brute-force KNN is v1; ANN is the documented upgrade behind the same seam); DEPLOY
(SHIP stops at the merged PR).

## Locked decisions implemented

| ADR                | What it requires in code                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0064**           | Two-way sync BUILT in-house (CRDT/LWW + tombstones over the SQLite session/changeset ext, behind a `SyncEngine` port; local store is canonical — sync converges peers toward it); `sqlite-vec` with a **locked embedding dim** (migration, not config); `InferenceBackend` port; **hybrid sqlite-vec + FTS5 RRF = the literal exit gate**; no live model calls in CI (stub at the port). |
| **0067**           | The vec0 + FTS5 + RRF-hybrid primitive lives in exactly one NEW base package `@caisson/local-store`; both P4 editions compose it down-only; `tier: paid` / `LicenseRef-Caisson-Commercial`; rebuilt clean from gridwork-core `memory-vec.ts` `hybridSearch` (patterns only).                                                                                                             |
| **0073**           | One SQLite DB file per tenant — the resolved file path IS the isolation boundary; `tenant_id → path` is a trusted server-side seam (reject `..`/null bytes; `path.resolve` + assert under the tenant-data root + `path.sep`); keys stay per-tenant-derived.                                                                                                                              |
| **0055**           | At-rest local encryption reuses field-crypto (per-tenant HKDF derivation, AEAD via the `AeadCipher` seam, self-describing envelope) — no second crypto stack; the local master-key source is a local-deployment secret, `tenant_id` bound into HKDF `info`.                                                                                                                              |
| **0050**           | Edition is fully-commercial: `tier: paid` / `LicenseRef-Caisson-Commercial`, NO AGPL/copyleft anywhere; the package.json `AGPL-3.0-only` flag is removed; the ADR-0022 AGPL gate stays a dormant tripwire.                                                                                                                                                                               |
| 0003 / 0022        | Editions are compositions; a package never depends up on an edition; down-only depcruise + manifest agreement for every new package.                                                                                                                                                                                                                                                     |
| 0013 / 0020        | Golden-file regression BEFORE logic; every package ships a `manifest.ts` + golden dir + `AGENTS.md` through the one `tooling/` standards gate; `BLESS=1` is the only fixture-update path.                                                                                                                                                                                                |
| 0044               | The reference app scaffolds on Next.js App Router; `@caisson/*` packages stay framework-free.                                                                                                                                                                                                                                                                                            |
| 0010 / 0007 / 0024 | License verify is offline/fail-safe (`crypto.verify`, not `timingSafeEqual`); the rented-backend meter reuses the append-only/integer/idempotent ledger shape — **seam only** here, live debit deferred to P6.                                                                                                                                                                           |

## Consumed seams (down-only; a package NEVER depends up on an edition — ADR-0003/0022)

- `@caisson/kernel` — `canonicalize()` (`audit-chain.ts:66`, license payload signing), `fetchWithTimeout`
  (`fetch.ts`, the single outbound chokepoint the egress guard wraps), `crypto.verify` discipline note
  (`crypto.ts:1-3` — asymmetric verify is NOT `timingSafeEqual`), typed errors, `parseStrict`/`strictObject`.
- `@caisson/field-crypto` — `DerivedKeyProvider`/`SyncFieldKeyProvider` (`provider.ts`), `deriveTenantKey`
  (`derive.ts`, `info="caisson-field-crypto:v"+kv+":"+tenantId`), `sealField`/`openField`/`encryptedColumn`,
  the `AeadCipher` seam + self-describing envelope (ADR-0045/0046). Reused for at-rest; **down-only edge**.
- `@caisson/local-store` (new base) — the edition's canonical/vector store; agent-dev (P4b) consumes it too.
- `tooling/` standards gate + `@caisson/testing` (golden harness, PGlite for any DB-touching test) +
  `.dependency-cruiser.cjs` (a down-only entry per new package). Seed = PUBLIC tessera (license token
  format) + health-service (SQLite `CREATE TABLE IF NOT EXISTS` + `schema_version` migration analog,
  zero-egress canonical-store posture) patterns ONLY — pro-private firewall holds (no `media-pipeline`).

## Exit gate (DONE-when — every clause testable, green with `BLESS` unset, no live network in CI)

1. **Hybrid retrieval green (the literal ADR-0064 gate):** `@caisson/local-store` returns the
   golden-ranked sqlite-vec-KNN + FTS5 results RRF-merged (RRF_K=60), and degrades to FTS5-only when
   embeddings are absent/failed — both paths golden-fixtured.
2. **Two-way sync converges two divergent SQLite replicas** in an integration test: concurrent
   per-field edits + a delete reconcile deterministically (LWW/CRDT + tombstone, no resurrection),
   both replicas byte-equal on the synced tables after a round-trip; conflict golden matches.
3. **Offline license verify:** a valid signed token verifies with zero network; a tampered token and
   an absent token both fail-safe to the community/free tier; signed-token KAT golden matches.
4. **Runs fully offline / zero-egress:** the privacy gate blocks every non-allowlisted host (empty
   allowlist = zero egress; no silent fallback to a hosted provider); FTS5 fallback works with no model.
5. **At-rest + isolation:** field-crypto seals/opens a sensitive column under a local per-tenant key;
   opening tenant B's DB file cannot return tenant A's rows (cross-tenant query is unexpressible).
6. **Standards green:** each new package carries a manifest + golden + `AGENTS.md` + a down-only
   depcruise entry; `bun run gate` / `bun run check` / repo-wide `bun test` green; the AGPL gate stays
   dormant (local-ai now commercial); CI runs the macOS+Linux matrix for the native `sqlite-vec` ext.
