# PLAN — Wave 1 / P5: Generator + registry full drive

Act 2 (PLAN) for `outputs/specs/wave1-p5-generator/SPEC.md`. Atomic tasks, one commit each, in
dependency order. Each task lists files, its verify command(s), and routing (`agent_type`/`model`).
Iterate each to green before committing. HARD RULES on every task: TS strict · Bun (never npm/yarn) ·
Zod `.strict()` at CLI/MCP boundaries · no `any`/`console.log` in product code · integer credits ·
`crypto.randomUUID` for ids/keys · `fetchWithTimeout` on every outbound fetch · `crypto.timingSafeEqual`
(`safeEqualFixed`) for secret compares · fail-closed · **no live cloud/model/network/publish in CI
(test-doubled)** · pro-private firewall (PUBLIC `tessera` + named patterns only, never `media-pipeline`
implementation) · every new package ships through `tooling/` with a manifest + golden + down-only
depcruise entry (ADR-0020-0022).

**Golden-before-logic (ADR-0013):** T7 precedes T8 · T10 precedes T11 · T14 precedes T15. Each golden
fixture lands and is committed before the logic that must match it.

## Build-order rationale

Two parallel chains converge at the MCP. **Spine (registry):** the 10 base manifests (T1) are the
hard precondition — backfill cannot publish an unmanifested package — then publishability/changeset
config (T2/T3) → `append-ledger` (T4) → the `publish-and-index` CI job (T5) → topological backfill
(T6). **Generation drive:** transform (T12) + writer (T13) + templates golden/engine (T14/T15) →
end-to-end `runGeneration` wiring (T17) → MCP convergence (T19) → tool-registration seam (T20). The
manifest pin-map (T7-T8), entitlement resolver (T9), and migration assembler (T10-T11) feed the
convergence. Generation tests run against a **fixture index**, so the two chains are isolatable in
parallel worktrees until T17/T19.

## Tasks

### T1 — Author the 10 missing base manifests · scope `registry` _(precondition)_

- Files: `packages/{auth,billing,credits,ai-config,mcp-server,tenancy-rls,ui,jobs,email,kernel}/manifest.ts`
  (+ each `AGENTS.md` if absent). `defineModule`: `kind:"base"`, `tier:"paid"`,
  `license:"LicenseRef-Caisson-Commercial"`, `priceCents:4900` **placeholder** (real number is the open
  Pricing board fork — do NOT bind a schedule), `dependencies` down-only (verified against package.json),
  `golden:null` until a module has golden-able output, `description` justifying `base`.
- Verify: `bun run gate` green (manifest↔package.json agreement, ADR-0020); `bun test tooling/standards-gate`.
- Route: gw-typescript-pro / sonnet. Deps: none (run first; parallelizable per-package).

### T2 — Per-package publishability flip · scope `registry`

- Files: publishable `packages/*/package.json` (add `publishConfig.registry=https://npm.pkg.github.com`
  - `repository`; drop `private`); `.changeset/config.json` (`ignore` for `apps/*`, `tooling/*`,
    `registry`, `services/*` — the `isModuleCandidate` boundary already exists in `checks.ts:22-26`).
- Verify: `bun install` clean; `bunx changeset status` lists only the publishable set; `bun run gate` green.
- Route: gw-typescript-pro / sonnet. Deps: T1.

### T3 — Changeset cascade + presence gate · scope `registry`

- Files: `.changeset/config.json` (`updateInternalDependencies:false` — avoids the kernel-patch
  republish storm ADR-0069 rejects); `.github/workflows/ci.yml` (a `changeset-status` job blocking a PR
  with no changeset).
- Verify: `bunx changeset status` runs; ci.yml lints (actionlint).
- Route: gw-typescript-pro / sonnet. Deps: T2.

### T4 — `append-ledger.ts` publish-time ledger appender · scope `registry`

- Files: `registry/scripts/append-ledger.ts` + `registry/scripts/append-ledger.test.ts`. Import each
  just-published `manifest.ts`, validate via `LedgerEntry`/`RegistryVersion`, append
  `{id,version,manifest,publishedAt,gateAttestation:"<ci-run-id>@<commit-sha>"}`; `publishedAt` = CI
  clock at publish, **never `Date.now()`** in the builder.
- Verify: `bun test registry/scripts` — append then `buildIndexFromLedgerFile` is byte-identical to the
  committed `index.json`; a malformed manifest throws.
- Route: gw-typescript-pro / sonnet. Deps: T1.
- **Threat (external-system):** registry-index integrity — CI-only writer; append validates the
  manifest schema; `gateAttestation` records provenance (not access control); byte-identical rebuild detects tamper.

### T5 — `publish-and-index` CI job · scope `registry`

- Files: `.github/workflows/ci.yml` (implement the commented stub). `needs:[check, standards-gate,
registry-index]` (the forced fix — `check` MUST be present so a green golden gate precedes publish,
  ADR-0021); `permissions: packages: write`; auth = built-in **`GITHUB_TOKEN`** (no stored secret,
  ADR-0069); `changeset version && changeset publish` **test-doubled / dry-run in CI** (no live
  publish); then `append-ledger` → `build-index` → commit-back on `main`. Record GHEC-attestation as
  **declined**, Worker-deploy as **deferred** (P5-25/26) in a job comment.
- Verify: ci.yml lints; a local script simulates append+rebuild byte-identical; the job has no
  `NODE_AUTH_TOKEN`/PAT.
- Route: opus main-thread (external-system + governance). Deps: T4.
- **Threat (external-system/secrets):** publish credential — only the ephemeral workflow `GITHUB_TOKEN`
  publishes; no laptop/stored credential; ledger+index writable only by CI (branch-protection +
  CODEOWNERS are operator-owned, already actioned per the board). **Threat (security):** the commit-back
  step writes ONLY `registry/ledger.jsonl` + `registry/index.json`.

### T6 — Topological backfill driver · scope `registry`

- Files: `registry/scripts/backfill.ts` + test. Kahn topo-sort over the manifest `dependencies` DAG
  (kernel→base→primitives→cli); publishes **only what exists**; an absent edition is skipped (not an
  error). Publish calls are **test-doubled** (no live network). First publish validates against an
  empty allowlist (ADR-0021 bootstrap).
- Verify: `bun test registry/scripts` — deterministic topo order; a missing edition is skipped; bootstrap
  (empty allowlist) handled.
- Route: gw-typescript-pro / sonnet. Deps: T1, T4.

### T7 — Golden: edition member-pin manifest · scope `registry` _(golden-before-logic)_

- Files: `registry/schema/__golden__/edition-manifest-pins.json` — an `edition` manifest carrying
  `members:{ "@caisson/x":"1.2.3", … }`.
- Verify: committed; referenced by T8's test.
- Route: haiku. Deps: none.

### T8 — Edition member-version pin map in the manifest schema (ADR-0077) · scope `registry`

- Files: `registry/schema/module-manifest.ts` (+ test). Add `members` = `Record<moduleId, exactSemver>`;
  refine `kind:"edition" ⟹ members non-empty`; reject `latest`/ranges (exact semver only).
- Verify: `bun test registry/schema` — golden matches; an edition without `members` throws; a range/`latest` is rejected.
- Route: gw-typescript-pro / sonnet. Deps: T7.

### T9 — Entitlement expansion resolver (ADR-0071) · scope `registry`

- Files: `registry/schema/entitlement-resolver.ts` + test. `expandEntitlements(index, boughtIds[])` →
  member-module slug `Set`, derived from each manifest's `editions[]`; bundle = ∪ editions + base; pure,
  parse-or-throw; no stored leaf list.
- Verify: `bun test registry/schema` — edition id expands to its members; bundle = union; an unknown id throws.
- Route: gw-typescript-pro / sonnet. Deps: T8.

### T10 — Golden: assembled migration sequence · scope `migrate` _(golden-before-logic)_

- Files: `packages/migrate/src/__golden__/` — a fixture set of per-package namespaced migrations + the
  expected merged `migrations/NNNN_*.sql` + the `schema_version` ledger.
- Verify: committed; referenced by T11's test.
- Route: gw-typescript-pro / sonnet. Deps: none.

### T11 — `@caisson/migrate` base package: assembler + runner + ledger (ADR-0070) · scope `kernel`

- Files: `packages/migrate/` — `src/assembler.ts` (topo-merge per-package forward-only migrations →
  one renumbered ordered sequence, ordered by the dep DAG, ties broken deterministically), `src/runner.ts`
  (runtime migration-runner), `src/schema-version.ts` (single checksum ledger over the merged set),
  `manifest.ts` (`kind:"base"`, golden dir), `package.json`, `tsconfig.json`, `eslint.config.js`,
  `AGENTS.md`, `README.md`, tests.
- Verify: `bun test packages/migrate/src` (merged output byte-matches the golden; single ledger);
  `bun run gate`; `bunx eslint packages/migrate` + depcruise down-only green.
- Route: opus main-thread (new base package, cross-package compose semantics). Deps: T10.

### T12 — `transform.ts`: token-replace + JSON deep-merge · scope `cli`

- Files: `packages/cli/src/transform.ts` + test. Typed `{{token}}` string replace (NO templating
  runtime, ADR-0068); JSON deep-merge for `package.json`/`tsconfig` with **sorted keys + fixed file
  order** (determinism); array-merge policy explicit (replace, documented).
- Verify: `bun test packages/cli/src/transform.test.ts` — token replace + deep-merge deterministic; unknown token left untouched/flagged.
- Route: gw-typescript-pro / sonnet. Deps: none.

### T13 — `writer.ts`: the disk `FileSetWriter` (ADR-0068) · scope `cli`

- Files: `packages/cli/src/writer.ts` + `writer.test.ts`. `path.resolve(targetDir, file.path)` + assert
  `startsWith(path.resolve(targetDir)+path.sep)`; reject `..`/null-byte/absolute and symlink-escape;
  refuse a non-empty target (opt-in `--overwrite`; `.` allowed for cwd); write into a sibling temp dir
  then `fs.rename` the whole dir into place (atomic); zero new dep.
- Verify: `bun test packages/cli/src/writer.test.ts` — zip-slip (`../`/absolute/null) rejected;
  non-empty-target refused; partial-write rolls back (no half-tree); happy path materializes.
- Route: gw-typescript-pro / sonnet _(security-sensitive → SHIP SECURITY-audit target)_. Deps: none.
- **Threat (security/path):** path traversal via a generated file path — `resolve`+root-`startsWith`
  containment + reject `..`/null/absolute/symlink; atomic temp-rename; non-empty refuse fail-closed.

### T14 — Golden: generated buyer-repo file set · scope `cli` _(golden-before-logic)_

- Files: `packages/cli/src/__golden__/` — the golden file SET for a fixed base selection AND a fixed
  edition selection, **including** the trimmed CI + the included modules' golden fixtures + `AGENTS.md`,
  and asserting the ADR-0072 boundary (NO registry/publish, standards-gate-authoring, or eval-gate file).
- Verify: committed; referenced by T15.
- Route: opus main-thread (defines what a bought repo contains — the ADR-0072 boundary). Deps: none.

### T15 — `templates/` tree + `engine-templates.ts` (ADR-0068/0072) · scope `cli`

- Files: `packages/cli/templates/{base,compliance,ai-kit,local-ai,agent-dev}/` (in-repo template tree —
  degit-pattern, no network), `packages/cli/src/engine-templates.ts` (a `GeneratorEngine` that recursively
  copies the selected templates + applies the T12 transform; emits the trimmed CI + golden + `AGENTS.md`
  per ADR-0072; harvests the gridwork-core `gw new` scaffold _shape_ only — no `media-pipeline`).
- Verify: `bun test packages/cli/src/generate.test.ts` — output byte-matches the T14 golden; the
  ADR-0072 boundary holds (no internal-only files emitted).
- Route: opus main-thread (cross-cutting catalog design). Deps: T12, T14.

### T16 — `generation-record.ts`: the `generation` audit row · scope `cli`

- Files: `packages/cli/src/generation-record.ts` (+ schema + RLS migration via `@caisson/migrate`
  conventions) + test. Append-only `generation` table: `account_id`, `idempotency_key`, selection
  snapshot, file-set hash, `created_at`; written **post-debit** inside the same `withTenant` txn;
  deduped by `idempotency_key`. (Reconciles plan.md "a generation row" with ADR-0049 — the debit still
  fires first; this is an audit record, NOT debited-from.)
- Verify: `bun test packages/cli/src` — row written after the debit; same-key retry writes once; RLS-scoped.
- Route: gw-typescript-pro / sonnet. Deps: T11.

### T17 — Wire `runGeneration` end-to-end · scope `cli`

- Files: `packages/cli/src/meter.ts` (inject the T13 writer — write **inside** the debit txn, ADR-0068),
  `src/generate.ts` (resolve `edition@x.y.z` → the pinned member set via ADR-0077 pins, exact-pin deps;
  call the T11 assembler to emit merged migrations into the file set), `src/generation-record.ts` wiring,
  `meter.integration.test.ts`.
- Verify: `bun test packages/cli/src/meter.integration.test.ts` (PGlite + `withTenant`): debit precedes
  write; 402 → nothing on disk; same-key retry debits once + re-materializes; generation row recorded.
- Route: opus main-thread (cross-cutting wiring). Deps: T11, T13, T15, T16.
- **Threat (billing):** generate-without-paying / runaway loop — debit-before-spend inside the txn; 402
  aborts with nothing written; same-`idempotencyKey` retry debits once.

### T18 — `cli.ts`: bin packaging, index resolution, post-gen side-effects · scope `cli`

- Files: `packages/cli/src/cli.ts`, `package.json` (bin → compiled `dist/cli.js` + `#!/usr/bin/env node`
  shebang, node-runtime target). Index resolution = **bundled snapshot + optional refresh** (offline-safe,
  not chronically stale); post-gen = write files + print next-steps; optional `git init` via
  **`execFile` arg-array** (no shell, no network/install — ADR-0068). Generated README documents the
  `.npmrc` `NODE_AUTH_TOKEN` install step (P5/P6 boundary).
- Verify: `bun test packages/cli/src`; a built bin runs `--help`/a dry plan; no shell-string interpolation.
- Route: gw-typescript-pro / sonnet. Deps: T17.
- **Threat (security):** subprocess injection — any post-gen subprocess is `execFile(cmd, [args])`, never a shell string.

### T19 — MCP `generate`-schema convergence onto the index allowlist · scope `mcp`

- Files: `packages/mcp-server/src/server.ts` (widen `generateArgs` to `{projectName, modules:[{id,version}],
idempotencyKey?}`; validate via `assertKnownModule`/`assertKnownVersion` against `loadRegistryIndex`;
  server **mints** the `idempotencyKey` UUID if absent; `onGenerate`→`runGeneration` adapter — hosted
  returns the file set, debit+record server-side in the txn), `package.json` (+ deps
  `@caisson/{registry,credits,tenancy-rls}`, still down-only/base).
- Verify: `bun test packages/mcp-server/src/server.test.ts` — id+version validated against the index;
  unknown id/version throws BEFORE any side-effect; key minted; the flat-string allowlist is gone.
- Route: opus main-thread (changes the mcp-server package graph). Deps: T9, T17.
- **Threat (security/injection):** unknown module id/version reaching a path — both CLI and MCP now gate
  id+version against the index before any path/subprocess (closes the divergent flat-string MCP gap).

### T20 — MCP tool-registration seam + per-tool entitlement gating (ADR-0076) · scope `mcp`

- Files: `packages/mcp-server/src/server.ts` (+ test). Replace the hard `switch` with a registration map;
  register base tools (`list_modules`/`describe_module`/`generate`, credit-gated) through it; each tool
  declares + re-validates (timing-safe) its required entitlement against the T9 resolver-expanded set;
  unentitled tools are invisible/denied. Edition-tool registration is an exposed seam (no edition tools built here).
- Verify: `bun test packages/mcp-server/src/server.test.ts` — registered tools gated; an unentitled tool denied; base generation tools intact.
- Route: gw-typescript-pro / sonnet. Deps: T19.
- **Threat (security/entitlement):** the MCP returns no data the caller is not entitled to — per-tool
  fail-closed gating, timing-safe Bearer, resolver-derived entitlement set.

### T21 — Idempotency continuity + per-account rate-limit on the MCP path · scope `mcp`

- Files: `packages/mcp-server/src/server.ts` (+ rate-limit store) + test. Server-minted key reused on a
  true retry (no double-debit); PG-backed per-account token-bucket (durable across restart/multi-instance).
- Verify: `bun test packages/mcp-server/src` — a replayed key debits once; the rate-limit trips; the limiter survives a simulated restart.
- Route: gw-typescript-pro / sonnet. Deps: T19.

### T22 — Docs: AGENTS/README + boundary notes · scope `docs`

- Files: `packages/{cli,migrate,mcp-server}/AGENTS.md`+`README.md`; the generated-repo README install
  step; `SUMMARY.md` where P5 claims change; record GHEC-provenance **declined** + Worker-deploy
  **deferred** (P5-25/26).
- Verify: `gw verify docs`; links resolve; claims match the code.
- Route: haiku. Deps: T18, T20.

### T23 — Full-repo green + VERIFY/SWEEP/SHIP · scope `cli`

- Verify: `bun install` clean · `bun run check`/`bun run gate` green · `bun test` repo-wide green · all
  goldens matched `BLESS` unset · `bun registry/scripts/build-index.ts && git diff --exit-code
registry/index.json` (byte-identical) · depcruise down-only clean · no live publish/network/cloud in CI.
- Route: opus main-thread. Deps: all.

## Dependency + parallelism notes

- **Shared-base ordering:** T11 (`@caisson/migrate`) and T9 (resolver) are base packages consumed by the
  generation wiring (T17) and the MCP (T19) — they must land before their consumers. The 10 base
  manifests (T1) gate the entire publish spine (T4-T6).
- **Parallel (isolated-worktree writers):** the registry spine (T1→T6), the manifest/resolver chain
  (T7→T9), the migrate package (T10→T11), and the generation primitives (T12, T13, T14→T15) are
  independent until they converge at T17 (generation wiring) and T19 (MCP). Run them in separate
  worktrees; do not let two agents write the same package tree.
- **Convergence points:** T17 needs {T11, T13, T15, T16}; T19 needs {T9, T17}; T20/T21 follow T19.

## Threats to model (SHIP SECURITY-audit targets — tags security · external-system · billing)

| #       | Threat                                                             | Mitigation (asserted in code/test)                                                                                            |
| ------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| TM-P5-1 | Path traversal / zip-slip via a generated file path (security)     | T13 `resolve`+root-`startsWith` containment; reject `..`/null/absolute/symlink; atomic temp-rename; non-empty refuse          |
| TM-P5-2 | Unknown module id/version reaching a path/subprocess (security)    | T15/T19 `assertKnownModule`/`assertKnownVersion` against the index BEFORE any path/subprocess, on BOTH CLI + MCP              |
| TM-P5-3 | Generate-without-paying / runaway loop (billing)                   | T17 debit-before-spend inside the txn; 402 nothing written; same-key idempotent; T21 server-minted key + rate-limit           |
| TM-P5-4 | Publish credential leak / laptop publish (external-system/secrets) | T5 ephemeral `GITHUB_TOKEN` only; no PAT/`NODE_AUTH_TOKEN`; publish CI-only; commit-back writes only ledger+index             |
| TM-P5-5 | Ungated/tampered registry index (external-system)                  | T4 CI-only append validates manifest; byte-identical rebuild detects tamper; `publishedAt` from CI clock; provenance recorded |
| TM-P5-6 | Network/supply-chain during generation (security)                  | ADR-0068 in-repo templates, no network; post-gen install/git opt-in; subprocess `execFile` arg-arrays only                    |
| TM-P5-7 | MCP returns data the caller isn't entitled to (security)           | T20 per-tool entitlement gating (resolver-expanded), timing-safe Bearer, fail-closed                                          |

## Done-when

The SPEC §"Exit gate" — all six conditions green with run-and-read evidence, every threat above
addressed for the SHIP SECURITY audit, PR open + CI green, no service restarted (no DEPLOY).
