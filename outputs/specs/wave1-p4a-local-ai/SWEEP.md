# SWEEP — Wave 1 · P4a: Local-first AI edition (downstream impact)

Act 5. What else the P4a diff touches: unblocked work, stale docs, new surfaces, queued follow-ups.
Retroactive (P4a merged in PR#11); written to close the act-trail.

## Sessions / work now unblocked

| Consumer                           | Unblocked by                                                 | Consumes                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **P4b Agent-Dev edition**          | `@caisson/local-store` (NEW `kind: base`, ADR-0067)          | the SAME `LocalStore` hybrid + `tenantDbPath`/`openTenantDb` floor + `Embedder` port + `gc`/`scrub` — composed down-only |
| **P6 commerce (issuer+debit)**     | `@caisson/license-verify` + the rented-backend `// P6:` seam | the offline verifier's signing format (issuer mints what `verify.ts` checks); `MeterSink` → live `credits.debit`         |
| **P5 generator/registry**          | three new manifests (local-store/license-verify/local-ai)    | `defineModule` rows + golden dirs in the allowlist; the edition's frozen `members` pin map (ADR-0077)                    |
| **Any edition needing offline AI** | the `InferenceBackend` port + privacy gate                   | swap `StubInferenceBackend`→`OnnxEmbeddingBackend`/`RentedInferenceBackend` behind one port; `EgressGuard` policy        |

## Docs reconciled (this diff)

- `knowledge/decisions/ADR-0050` + `ADR-0083` — local-ai fully-commercial; the AGPL flank retired. ✅
- `knowledge/decisions/ADR-0064/0067/0073` — edition architecture, base local-store, file-per-tenant. ✅
- Package `README.md` + `AGENTS.md` for all three new packages; the `specs/01 §2` "hosted inference,
  no local models" doc-tension reconciled inline (`pipeline.ts:RECONCILIATION_NOTE` — governs the
  SELLER platform's Python plane, not this buyer-side edition). ✅
- **This act-trail (VERIFY.md + SWEEP.md)** — the debt PR#11 left open. ✅

## New surfaces (note for future audits)

- **`@caisson/local-store` is a NEW shared base** — both P4 editions import it; broader than the SPEC
  sketch: it also ships `gc.ts` (dedup/TTL/decay retention) + `egress-guard.ts` (a cloud-embed secret
  **scrub** path, golden-pinned `scrub.json`) + the `Embedder` port. These are the shared-base surface
  P4b also consumes — golden-pinned and tested, but a second egress concept distinct from the edition's
  `privacy/egress-guard.ts` (scrub-before-cloud-embed vs host-allowlist) — keep the two from drifting.
- **Native `sqlite-vec` extension** — the store `loadExtension`s it; macOS needs an extension-capable
  SQLite (`Database.setCustomSQLite`, `store.ts:25-39`). The CI macOS+Linux matrix is the guard; a
  buyer on Apple-system-SQLite without Homebrew sqlite hits the clear fail-closed `loadExtension` error.
- **Two un-exercised live egress sinks** — the ONNX model-fetch host (`model-fetch` sink) and the
  rented-backend host (`rented-backend` sink). Both are off by default (zero-egress policy) and the
  `SanctionedSinkKind` enum is closed; when a deployer opts either in, it becomes a real external sink.
  No live call ships in P4a (the surfaces ledger is unaffected until a deployer allowlists a host).
- **IRREVERSIBLE schema** — the `vec0 FLOAT[DIM]` width + the `sync_meta`/`sync_changelog` columns have
  no rollback (`store/migrate.ts` header + drift guard). Changing the embedding model = fresh store +
  re-index, never an in-place migration. The `data-migration` tag's core assertion.

## Queued follow-ups (non-blocking)

1. **EVAL act (`ai` tag)** — run the eval-runner over the retrieval/inference surface and record an
   EVAL note; P4a's retrieval determinism is golden-pinned but the EVAL gate was not separately captured.
2. **Phase-level SECURITY audit** — author a `SECURITY.md` for P4a's 7 threats (TM-EGRESS/MODEL/ISO/
   REST/LIC/SYNC/RENT) to match the Wave-0 / P5 act-trail; per-threat mitigations are coded + tested,
   the adversarial audit pass is the missing artifact.
3. **Wire the ONNX seam** — an integration test (or a documented manual harness) that loads a real
   hash-pinned model once and asserts a 384-dim vector, so "real local embeddings" has live evidence
   beyond the stub. Keep it out of the default CI lane (ADR-0064 no-live-model).
4. **P6: live rented debit** — replace the `MeterSink` no-op with `credits.debit` (append-only/integer/
   idempotent); the record shape already ships.
5. **`priceCents` finalization** — local-store 4900 / license-verify 4900 / local-ai 34900 are
   placeholders pending the open "Pricing numbers" board fork (out of P4a scope).

## Post-merge note (Act 7 SHIP)

P4a shipped inside the Wave-1 integration **PR#11** (all four editions + shared base + design folded to
one branch → main, superseding the per-edition PRs #5–10). Its conditional audits (SECURITY · EVAL ·
migration-safety, per the SPEC tags) were not separately recorded at the phase level — captured here as
follow-ups 1–2. No service was restarted (DEPLOY is operator-gated, outside the cycle).

## No regressions

Merged green via PR#11 · all three new packages ship through the one `tooling/` standards gate
(manifest↔package.json agreement, down-only depcruise) · the AGPL gate stays a dormant tripwire
(local-ai now commercial) · goldens (rrf-ranking · scrub · lww-resolve · tombstone-resolve · signed-token)
matched with `BLESS` unset · no service touched.
