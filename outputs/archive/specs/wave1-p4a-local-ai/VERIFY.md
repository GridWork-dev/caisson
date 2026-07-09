# VERIFY — Wave 1 · P4a: Local-first AI edition (goal-backward)

Act 4. Re-asks the SPEC's stated goal against the merged diff + tests — not a task checklist. Closes
the documented VERIFY-debt (P4a merged green in PR#11 carrying only SPEC.md + PLAN.md). Assessed by
reading source + tests (CI is green on main; `bun run check` not re-run — dist-glob/turbo-contention
gotcha, per the act brief).

## Goal restated

Ship the **Local-first AI edition** — fully-commercial (ADR-0050/0083, no AGPL anywhere), offline,
no-lock-in AI over a single-file-per-tenant SQLite store: `@caisson/local-store` (sqlite-vec + FTS5 +
RRF hybrid) + a **built two-way sync engine** (LWW/CRDT + tombstones) + an `InferenceBackend` port
(stubbed in CI) + a zero-egress privacy gate + offline Ed25519 license verify + at-rest field-crypto +
file-per-tenant isolation. The WHY is the test: the marquee promise is hollow if sync is a stub or
egress is merely claimed — VERIFY re-asks whether the built stack actually **converges replicas,
retrieves hybrid-offline, and enforces zero-egress**.

## Did the code achieve the goal? — PARTIAL (every clause met with real tests; live transports unexercised by design)

| Exit-gate clause (SPEC §"Exit gate")                                                    | Evidence (read)                                                                                                                                                                                 | Verdict |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1 · Hybrid RRF green (the literal ADR-0064 gate) + FTS-only degrade                     | `local-store/src/store.ts:132-153` (RRF_K=60 fusion, caught vec-leg degrade); golden `__golden__/rrf-ranking.json` enforced via `golden.ts:134-172`; `store.test.ts:24-67` (degrade + vec-only) | ✅      |
| 2 · Two divergent replicas converge (concurrent per-field edits + delete, byte-equal)   | `sync/convergence.integration.test.ts:150-187` (2 real `bun:sqlite` replicas, byte-equal snapshot, no resurrection); `reconcile.test.ts` lww+tombstone goldens via `matchGolden`                | ✅      |
| 2b · LWW/CRDT determinism (forged-clock-resistant; order-independent)                   | `sync/clock.ts:54-59` (strict total order physical→node→counter); `reconcile.ts:48-104` (replicaId tiebreak); `convergence…test.ts:189-206` (two independent runs identical)                    | ✅      |
| 2c · Tombstone no-resurrection across sync rounds + GC horizon                          | `sync/tombstone.ts:66-119`; `convergence…test.ts:223-250` (persisted tombstone suppresses a redelivered stale upsert; fresh replica control resurrects → tombstone is load-bearing)             | ✅      |
| 3 · Offline license verify (valid→tier; tamper/absent/expired→community; KAT golden)    | `license-verify/src/verify.ts:66-117` (`crypto.verify`, never throws); `verify.test.ts:70-208` (KAT byte-match, 8 fail-safe paths incl. wrong-key + non-canonical + extra-key)                  | ✅      |
| 4 · Zero-egress / runs offline (empty allowlist blocks all; no silent hosted fallback)  | `privacy/egress-guard.ts:78-100` (fail-closed, https-only, no path leak); `egress-guard.test.ts:125-238`; `apps/local-ai/app/demo/pipeline.test.ts:14-38` (whole demo, `fetchCalls === 0`)      | ✅      |
| 5 · At-rest + isolation (per-tenant seal; tenant-B cannot open tenant-A; no cross-read) | `crypto/at-rest.ts:36-89` (field-crypto composition); `at-rest.integration.test.ts:30-122` (round-trip, AEAD auth-fail, unexpressible cross-tenant, missing master-key fails closed)            | ✅      |
| 5b · file-per-tenant path is the boundary (`..`/null/absolute rejected pre-open)        | `local-store/src/tenant-db.ts:28-56` (pure resolve + root-prefix assert); `tenant-db.test.ts:22-66` (7 bad-id rejects before any open; distinct files; cross-query throws)                      | ✅      |
| 6a · Edition migration assembly idempotent + IRREVERSIBLE vec0 dim-lock                 | `store/migrate.ts:178-211` (forward-only ledger, checksum-drift throws); `migrate.test.ts:51-156` (topo-merge, re-apply no-op preserves rows, dim-16-after-dim-8 → "irreversible drift")        | ✅      |
| 6b · Standards: manifest+golden+down-only deps; AGPL flank retired → commercial         | `local-ai/manifest.ts` (kind:edition, tier:paid, `LicenseRef-Caisson-Commercial`, golden=`src/sync/__golden__`); `package.json` license flipped (T1); base manifests paid+golden                | ✅      |

## Acknowledged SEAMS (by-design, ADR-0064 — recorded, NOT failures)

- **Real on-device ONNX embedding backend** (`inference/onnx-backend.ts`) — fully written (guarded
  `env.fetch` chokepoint, SHA-256 hash-pin, air-gap `offline:true`) but **never exercised in CI**: the
  live transformers.js model load + first-run download is the single un-exercised path. ADR-0064
  mandates no live model in CI; `StubInferenceBackend` (`inference/stub.ts`, deterministic mulberry32)
  is the only backend any test runs. The "real local embeddings" promise ships as code, not as
  live-execution evidence.
- **Rented/hosted inference backend** (`inference/rented-backend.ts`) — off-by-default, privacy-gated,
  metered-shape-only; the live transport (`createLiveRentedTransport`) is un-exercised (tests inject a
  double) and live `credits.debit` is an explicit `// P6:` seam — append-only/integer/idempotent
  `UsageMetering` record ships, the ledger wiring is deferred to P6 commerce.
- **Sync wire transport** — test-doubled (in-process `JSON.stringify` → `parseChangeset`), no socket.
  The merge engine + the two `bun:sqlite` replicas are real; only the network leg is a double by design.
- **License issuer** — P6; only offline verify lands here (SPEC OUT-of-scope, as designed).
- **Completion generation** (`InferenceBackend.complete`) — port + stub echo only; no real generation
  anywhere in the edition (the generation seam belongs to the rented backend, P6).

## Gaps / follow-ups (non-blocking)

- **EVAL act (Act 6, `ai` tag) not recorded for this phase** — the SPEC declares `ai`, which fires
  EVAL over the retrieval/inference surface. No EVAL note exists in the phase dir; retrieval determinism
  is golden-pinned, but the eval-runner gate was not separately captured. Queue → SWEEP.
- **SECURITY audit artifact (Act 7, `security`/`data-migration` tags) not in the phase dir** — the
  threat model (TM-EGRESS/MODEL/ISO/REST/LIC/SYNC/RENT, PLAN §Threats) is mitigated + tested per-threat
  in code, but no phase-level `SECURITY.md` was written (unlike Wave-0 / P5). Queue → SWEEP.
- **`priceCents` placeholders** (local-store 4900 / license-verify 4900 / local-ai 34900) await the
  open "Pricing numbers" board fork — out of P4a scope (mirrors Wave-0).

## Verdict: PARTIAL — the three marquee promises (converge · hybrid-offline · zero-egress) are met with real, golden-pinned, deterministic tests over real SQLite; PARTIAL (not PASS) because every live/networked path — on-device ONNX embeddings, rented inference, the sync wire, the P6 debit — is a typed port stubbed by design (ADR-0064) and the EVAL + SECURITY acts are unrecorded for this phase. Proceed to SWEEP; no goal-blocking gap.
