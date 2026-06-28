# PLAN — Wave 1: shared base layer

Act 2 (PLAN) for `outputs/specs/wave1-shared-base/SPEC.md`. Atomic tasks, one commit each,
dependency order. Every task lists its verify command(s); iterate to green before committing.
Build-order rationale: the **uniform-commercial reconcile lands first** so every new/edited manifest
validates under one license model; then the two NEW base packages (leaf, dep `@caisson/kernel` only)
in parallel isolated worktrees; then the cross-cutting contracts that extend existing base packages.
Golden-before-logic (ADR-0013) where a task produces deterministic output: the golden fixture is
authored + committed (red) before the logic that turns it green.

## Tasks

### T1 — ADR-0050 uniform-commercial reconcile · scope `adr`/`tooling`

- Edit `registry/schema/module-manifest.ts`: `SPDX_LICENSES` → `["LicenseRef-Caisson-Commercial"]`;
  DROP the `AGPL ⟺ local-ai` refine; simplify `tier ⟺ license` to `paid ⟺ Commercial` (`oss` now has
  no valid license → dead per ADR-0050). Edit `packages/local-ai/package.json` `license` →
  `LicenseRef-Caisson-Commercial`. Keep the `@caisson/standards-gate` AGPL check wired as a DORMANT
  tripwire (comment at `tooling/standards-gate/src/checks.ts`).
- Add license cases to `registry/schema/module-id.test.ts` (or a new `manifest-license.test.ts`): a
  commercial paid manifest validates; an `AGPL-3.0-only` license is rejected; an `oss` tier is rejected.
- **Verify:** `bun test registry/schema` green; `bun run gate` green; existing field-crypto + cli
  manifests still validate. **Routing:** opus main-thread (licensing keystone — the whole gate keys off it).

### T2 — `@caisson/agent-kernel` scaffold + gate rows · scope `kernel`/`scaffold`

- `packages/agent-kernel/{package.json,tsconfig.json,eslint.config.js,README.md,AGENTS.md}` +
  `src/index.ts` stub; `manifest.ts` (`defineModule`, `kind:"base"`, `tier:"paid"`,
  `LicenseRef-Caisson-Commercial`, `priceCents` placeholder, dep `["@caisson/kernel"]`,
  `golden:"src/__golden__"`).
- Add `agent-kernel` to `.dependency-cruiser.cjs` `BASE_PKGS` + the `@caisson/standards-gate`
  workspace list (down-only coverage, ADR-0022).
- **Verify:** `bun install` clean; `bun run gate` validates the manifest↔package.json; `bunx depcruise
packages apps tooling --config .dependency-cruiser.cjs` green. **Routing:** gw-typescript-pro/sonnet.

### T3 — agent-kernel golden fixture (FSM trace + schema sample) · scope `kernel` — GOLDEN-FIRST (ADR-0013)

- `packages/agent-kernel/src/__golden__/lifecycle-trace.json` (the expected transition trace for a fixed
  act sequence) + `__golden__/agent-schema.json` (a serialized agent/skill/rule sample); a `golden.ts`
  `defineModuleGolden` descriptor referencing the to-be-built FSM/schema API; a red test asserting the
  produced output equals the committed golden.
- **Verify:** golden committed; the test is RED (logic absent) — proves the fixture precedes the logic.
  **Routing:** gw-typescript-pro/sonnet. **Precedes T4.**

### T4 — agent-kernel logic (schema + FSM + hooks) · scope `kernel`

- `src/schema.ts` (agent/skill/rule Zod `.strict()`), `src/lifecycle.ts` (the act FSM — legal
  transitions only; an illegal transition throws, flag-never-guess), `src/hooks.ts` (the hooks
  dispatcher), `src/index.ts` barrel; tests (transition trace matches T3 golden; illegal transition
  throws; schema round-trip + unknown-field reject).
- **Verify:** `bun test packages/agent-kernel/src` green incl. the golden (BLESS unset); `bun run gate`.
  **Routing:** gw-typescript-pro/sonnet (bounded <~300 LOC). **Depends T3.**

### T5 — `@caisson/local-store` scaffold + gate rows · scope `local-ai`/`scaffold`

- `packages/local-store/{package.json (deps @caisson/kernel + the sqlite-vec native ext),tsconfig.json,
eslint.config.js,README.md,AGENTS.md}` + `src/index.ts` stub; `manifest.ts` (`kind:"base"`,
  `tier:"paid"`, Commercial, dep `["@caisson/kernel"]`, `golden:"src/__golden__"`).
- Add `local-store` to `.dependency-cruiser.cjs` `BASE_PKGS` + the standards-gate workspace list.
- **Verify:** `bun install` clean; `bun run gate` green; depcruise green. **Routing:**
  gw-typescript-pro/sonnet.

### T6 — local-store golden fixture (RRF ranking) · scope `local-ai` — GOLDEN-FIRST (ADR-0013)

- `packages/local-store/src/__golden__/rrf-ranking.json` — the expected hybrid-merge ordering for a fixed
  `(vectors, FTS docs, query)` input (RRF_K=60); `golden.ts` descriptor + a red test referencing the
  to-be-built `hybridSearch`.
- **Verify:** golden committed; test RED. **Routing:** gw-typescript-pro/sonnet. **Precedes T7.**

### T7 — local-store hybrid retrieval logic · scope `local-ai`

- `src/store.ts` — raw `bun:sqlite` over vec0 (FLOAT[N], dim fixed at table creation) + FTS5; an
  always-available FTS path; `hybridSearch` RRF merge (RRF_K=60) when embeddings exist, degrading to
  FTS5-only on a missing/failed vec leg. Rebuilt clean from the PUBLIC gridwork-core `memory-vec.ts`
  pattern (firewall held); embedding stays an injected seam. Tests: golden ranking matches; vec-leg-removed
  → FTS5-only still returns; dimension-mismatch throws.
- **Verify:** `bun test packages/local-store/src` green incl. golden (BLESS unset); `bun run gate`.
  **Routing:** gw-typescript-pro/sonnet. **Depends T6.**

### T8 — ADR-0073 file-per-tenant isolation floor · scope `tenancy-rls`/`local-ai` (security)

- `packages/local-store/src/tenant-db.ts` — `tenantDbPath(root, tenantId)`: reject `..`/null bytes/absolute
  ids, `path.resolve` + assert the result starts with the tenant-data root + `path.sep`; `openTenantDb`
  opens exactly one tenant's file. The `tenant_id → path` map is a trusted server-side seam (never
  user-supplied). Tests: a traversal/null/absolute id throws BEFORE any open; two tenants resolve to
  distinct files; a cross-tenant query is not expressible (separate connections).
- **Verify:** `bun test packages/local-store/src/tenant-db.test.ts` green; `bun run gate`. **Routing:**
  gw-typescript-pro/sonnet. **Depends T5/T7 (local-store exists).**

### T9 — ADR-0075 EventSink port + redaction-at-sink · scope `kernel` (security/secrets)

- `packages/kernel/src/event-sink.ts` — the `EventSink` port (emit structured ops events); a default
  in-memory/noop sink for tests; an OTel→Postgres transport behind the port (test-doubled, no live CI
  call; `fetchWithTimeout` on any export). Redaction applied ONCE at the sink reusing the ADR-0019
  allowlist/redaction (no SQL/stack/secret in an event). Export from `src/index.ts`. Assert the ADR-0052
  audit-chain is NOT routed through the sink.
- **Verify:** `bun test packages/kernel/src` green (redaction strips secret/SQL/stack; emit captured).
  **Routing:** gw-typescript-pro/sonnet. **Serializes with T10/T14 on `kernel/src/index.ts`.**

### T10 — ADR-0075 shared observability schemas · scope `kernel`

- `packages/kernel/src/observability.ts` — evidence-pack · usage-metering · eval-result Zod `.strict()`
  schemas (the ONE shared base home the P6 dashboard/docs/bot read); `src/__golden__/observability-samples.json`
  canonical valid samples. Export from `src/index.ts`. Tests: each schema parses its sample; unknown
  fields rejected.
- **Verify:** `bun test packages/kernel/src` green; `bun run gate`. **Routing:** gw-typescript-pro/sonnet.
  **Serializes with T9/T14 on the kernel barrel.**

### T11 — ADR-0074 credit event-type extension · scope `credits`/`billing`

- `registry/schema/feature-tags.ts` FIRST — the registered feature-tag set (`evidence_pack`,
  `inference_call`, `codegen_run`, …) + `assertRegisteredFeatureTag` (Zod `.strict()`). Then
  `packages/credits/src/schema.ts` (add a `feature text` payload column + a CHECK that `feature` is
  present iff `event_type ∈ {feature_debit, feature_grant}`) + `packages/credits/src/credits.ts` (add
  `feature_debit`/`feature_grant` to the type sets; validate the supplied `feature` against the registered
  set, fail-closed; integer-only amount; idempotency key UNCHANGED — `feature` is payload). Tests
  (PGlite + `withTenant`): a registered tag debits integer credits idempotently; an unregistered tag
  fails closed with no ledger write; legacy `codegen_debit`/`ai_feature_debit` unchanged.
- **Verify:** `bun test packages/credits/src` green; `bun run gate`. **Routing:** gw-typescript-pro/sonnet.

### T12 — ADR-0071 entitlement-expansion resolver · scope `registry` (security) — GOLDEN-FIRST (ADR-0013)

- `registry/schema/__golden__/entitlement-expansion.json` (expected member slugs for a fixed index) + a red
  test; then `registry/schema/entitlements.ts` — `expandEntitlements(index, purchasedIds)`: derive an
  edition's members = every manifest whose `editions[]` contains it; the bundle = base + all editions;
  membership from the index ONLY (never token-baked); an unknown purchased id fails closed. Reads the built
  index (`loadRegistryIndexFromFile`), not raw manifests per call.
- **Verify:** `bun test registry/schema` green; golden matches (BLESS unset). **Routing:**
  gw-typescript-pro/sonnet.

### T13 — ADR-0076 buyer-MCP tool-registration seam · scope `mcp`/`auth` (security)

- `packages/mcp-server/src/server.ts` — replace the hard `switch` with a `ToolRegistration` registry; each
  tool declares `requiredEntitlement`; `handleToolCall` re-validates the caller's entitlement per tool
  (timing-safe; invisible/denied + excluded from the tool list if not entitled). Register base
  `list_modules`/`describe_module`/`generate` through the seam (`generate` keeps its `onGenerate` credit
  re-check + allowlist gate); expose the `registerTool` API editions will use. Tests: a registered
  edition-scoped tool is denied + hidden for a non-entitled caller; base tools still work.
- **Verify:** `bun test packages/mcp-server/src` green; `bun run gate`. **Routing:** opus main-thread
  (buyer-MCP auth surface — auth/security; the core server refactor).

### T14 — ADR-0070 migration-assembly algorithm (kernel, pure) · scope `kernel`/`infra` — GOLDEN-FIRST

- `packages/kernel/src/__golden__/migration-merge.json` (the merged renumbered sequence + the
  `schema_version` checksum for a fixed 2-package input) + a red test; then
  `packages/kernel/src/migration-assembly.ts` — pure topological merge ordered by the package dep DAG
  (deterministic tie-break) into ONE renumbered `NNNN_*.sql` sequence + ONE `schema_version` checksum
  ledger over the merged set (append-only, ADR-0014). No file IO here (pure, golden-able). Export.
- **Verify:** `bun test packages/kernel/src` green; the golden is byte-stable. **Routing:**
  gw-typescript-pro/sonnet. **Serializes with T9/T10 on the kernel barrel; precedes T15.**

### T15 — ADR-0070 cli assembler driver + runner seam · scope `cli`/`infra`

- `packages/cli/src/migrate/assemble.ts` — reads each selected package's `migrations/NNNN_*.sql`, feeds the
  T14 kernel algo, emits the merged renumbered sequence + the single `schema_version` ledger into the
  generated app; a base migration-runner seam (apply-in-order + record checksums; no live DB in CI — test
  against a fixture dir / PGlite). Tests: two fixture packages → one ordered sequence + one ledger; re-run
  byte-identical.
- **Verify:** `bun test packages/cli/src` green; `bun run gate`; depcruise green. **Routing:**
  gw-typescript-pro/sonnet. **Depends T14.**

### T16 — full-repo green + VERIFY/SWEEP/SHIP · scope (cross)

- **Verify:** `bun install` clean; `bun run gate` green (both new manifests; down-only depcruise incl.
  agent-kernel + local-store); `bun run check` green; `bun test` repo-wide green; all goldens matched
  with `BLESS` unset; `bunx depcruise packages apps tooling --config .dependency-cruiser.cjs`. Goal-backward
  VERIFY vs the SPEC exit gate; SWEEP downstream (registry backfill of the two packages is queued P5).
  **Routing:** opus main-thread.

## Dependency notes

- **T1 first** — uniform-commercial gates every new/edited manifest's validation.
- **Two NEW base packages are parallel isolated-worktree writers** (different trees): **Lane A**
  agent-kernel `T2 → T3 → T4`; **Lane B** local-store `T5 → T6 → T7 → T8` (T8 file-per-tenant needs the
  package). Run with `isolation:"worktree"` (`gw start --wt`).
- **Cross-cutting contracts** touch distinct existing packages and parallelize among themselves —
  **except** the three kernel-touching tasks `T9, T10, T14` all edit `packages/kernel/src/index.ts` →
  **serialize them (or single-worktree)** to avoid a barrel conflict. `T14 → T15` (cli driver needs the
  kernel algo). `T11` (credits+registry), `T12` (registry), `T13` (mcp-server) are mutually independent.
- **Golden-before-logic (ADR-0013):** `T3<T4`, `T6<T7`, `T12` golden<resolver, `T14` golden<algo;
  `T10` commits its schema samples with the schemas.
- **Critical-path dependency:** `T1 → T5 → T6 → T7 → T8` (local-store + the file-per-tenant isolation
  floor) is the longest chain; the parallel long chain is `T1 → T14 → T15` (migration kernel algo → cli
  driver). The single load-bearing ordering: **the NEW base packages land before the contracts that
  target them** — local-store before ADR-0073 file-per-tenant, and the kernel migration algo before the
  cli driver.

## Threats to model (drives the SHIP SECURITY audit — tags security/billing/infra; test-doubled secrets/external-system)

| #    | Threat                                                                                            | Mitigation (asserted in code/test)                                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TM-A | A buyer MCP edition tool returns data to a non-entitled caller (auth/security)                    | per-tool timing-safe entitlement re-validation; tool invisible + denied unless entitled (T13)                                                          |
| TM-B | Cross-tenant read on the local SQLite tier (security)                                             | one DB file per tenant; resolver rejects `..`/null/absolute, `path.resolve`+root-prefix assert; cross-file query inexpressible (T8)                    |
| TM-C | A secret / SQL / stack leaks into an operational event (secrets)                                  | ADR-0019 redaction applied ONCE at the EventSink; no secret in an event/embedding payload (T9)                                                         |
| TM-D | An unregistered/typo `feature` tag mints a silent meter (billing/security)                        | Zod `.strict()` validation vs the registered tag set, fail-closed on unknown; integer amount; idempotency unchanged (T11)                              |
| TM-E | The entitlement resolver over-expands a purchase (security)                                       | membership derived from the index `editions[]` ONLY — never token-baked/hand-listed; fail-closed on an unknown purchased id (T12)                      |
| TM-F | The migration assembler emits a non-deterministic/duplicate sequence or drifts the ledger (infra) | deterministic topo-merge tie-break + ONE `schema_version` checksum over the merged set; golden-pinned + byte-stable re-run; no live DB in CI (T14/T15) |
| TM-G | AGPL/permissive contamination re-enters the tree (external-system/licensing)                      | SPDX allowlist = commercial-only; AGPL gate kept as a dormant CI tripwire that hard-fails a re-introduced AGPL dep (T1)                                |

## Done-when

The SPEC §"Exit gate" — all green, run-and-read evidence, PR open + CI green, no service restarted.
