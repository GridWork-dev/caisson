# SPEC — Wave 1 / P5: Generator + registry full drive

Act 1 (SPEC) of the 7-act cycle for the P5 surface. Source plan: `plan.md §P5`. Research input:
`outputs/research/wave1-forks.md §P5-generator` (26 forks, all LOCKED) + cross-cutting X-3/X-4/X-12/X-13.
Bound by the ADRs cited below — do not relitigate; implement what they require.

## Goal

Drive the Wave-0 generator + registry **seams to completion**: turn the shipped, in-memory-only
`runGeneration`/`FileSetWriter`/`GeneratorEngine` seams and the static CI-built registry index into a
real product — `create-caisson` (CLI) and the buyer MCP both compose a _runnable, testable buyer repo_
from a registry selection, debit-before-spend, through a path-safe atomic disk writer; the registry
publishes its existing substrate (kernel + base + primitives + cli) through one CI-only gated flow and
backfills the index. WHY: this is the Option-C delivery surface — without it the four editions have no
distribution channel and the "agent-native generation" headline (ADR-0008/0040) is an unbuilt RPC.

## Tags

`external-system` (publish to GitHub Packages; the publish-and-index CI job) · `security` (the
FileSetWriter path-safety re-assertion; the index/CLI/MCP allowlist gate) · `billing` (the codegen
credit debit on every generation). Drives the SHIP conditional audits: **SECURITY audit** (security)

- **infra review** (the CI publish job) fire; the billing tag targets the debit-before-spend path.
  No `ui`/`frontend`/`ai` surface.

## Scope

**Creates**

- **`@caisson/migrate`** (NEW base pkg `packages/migrate/`) — compose-time migration **assembler** +
  runtime migration-runner + single `schema_version` checksum ledger (ADR-0070).
- **`packages/cli/templates/{base,compliance,ai-kit,local-ai,agent-dev}/`** — the in-repo template
  tree the generator copies (ADR-0068/0072).
- **`packages/cli/src/{writer,transform,engine-templates,generation-record}.ts`** — the disk
  FileSetWriter, the token/JSON-merge transform, the templates-tree engine, the `generation` audit row.
- **`registry/schema/entitlement-resolver.ts`** (ADR-0071) · **`registry/scripts/{append-ledger,backfill}.ts`**
  (ADR-0069) · the **`publish-and-index`** CI job in `.github/workflows/ci.yml`.

**Extends**

- `packages/{auth,billing,credits,ai-config,mcp-server,tenancy-rls,ui,jobs,email,kernel}/manifest.ts`
  — the **10 missing base manifests** (ADR-0020; precondition for backfill).
- `packages/mcp-server/src/server.ts` (+ `package.json` deps) — generate-schema convergence onto the
  index allowlist, the tool-registration seam, the `onGenerate`→`runGeneration` adapter, rate-limit.
- `registry/schema/module-manifest.ts` — the edition member-version **pin map** (ADR-0077).
- `packages/cli/src/{cli,meter}.ts`, `manifest.ts`, `package.json` — bin packaging, index resolution,
  writer wiring · `.changeset/config.json` + per-package `package.json` publishability (ADR-0069).

**Out of scope** — real entitlement store / OAuth-2.1 MCP auth (P6; static timing-safe Bearer stays) ·
worker **deploy** (stays the undeployed ADR-0047 seam) · edition buyer-tool _content_ (compliance
`explain_control` etc. are edition-owned — P5 ships only the registration seam + base generation
tools) · pricing numbers / price-book / subscription-allotment issuer (open board fork; flat 1
credit/generation, placeholder `priceCents`) · per-buyer install token automation (P6) · GHEC
provenance attestations (declined, recorded) · any edition feature code · DEPLOY (SHIP = merged PR).

## Locked decisions implemented

| ADR      | Requires in code                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0068** | Real `templates/` tree; `FileSetWriter` re-asserts path safety (reject `..`/null/absolute; `path.resolve`+root-`startsWith`), refuses a non-empty target by default, writes atomically (temp-dir→rename); transform = `{{token}}` replace + JSON deep-merge, **no runtime, no network**; disk write **inside** the `withTenant` debit txn; install/git-init/next-steps are opt-in side-effects **outside** the txn. |
| **0069** | Publish via built-in `GITHUB_TOKEN` + `permissions: packages: write` (no stored PAT/`NODE_AUTH_TOKEN`); changesets presence-gate + `updateInternalDependencies:false`; **incremental** backfill (publish what exists; editions land as they ship); `--edition` degrades gracefully; `append-ledger` snapshots the manifest + stamps `gateAttestation`/`publishedAt`.                                                |
| **0070** | Compose-time assembler topo-merges per-package namespaced forward-only migrations → ONE renumbered `migrations/NNNN_*.sql` sequence + one `schema_version` checksum ledger; authority = generator + base `@caisson/migrate`; no edition owns ordering.                                                                                                                                                              |
| **0071** | A resolver expands a purchased edition/bundle id → member-module slug set **derived from the index `editions[]`** (bundle = ∪ editions + base); the token carries bought ids, not the leaf set; the gate checks the derived set. P5 wires the **index allowlist**; real entitlement store = P6.                                                                                                                     |
| **0072** | The generated repo emits a **trimmed CI** (`build·lint·unit·golden` for included modules) + those golden fixtures + `AGENTS.md`, all commercial/buyer-owned; it **never** emits the registry/publish flow, the standards-gate authoring scanner, or the eval CI gate.                                                                                                                                               |
| **0076** | The buyer MCP exposes a **tool-registration seam** (not a fixed `switch`) with per-tool entitlement gating; base generation tools (`list_modules`/`describe_module`/`generate`, credit-gated) register through it; edition tool registration is an exposed seam (no edition tools built here).                                                                                                                      |
| **0077** | An `edition` manifest pins an exact `member-id → version` map; the generator resolves `edition@x.y.z` to the **frozen pinned set** (reads pins, never `latest`); members version independently.                                                                                                                                                                                                                     |

## Consumed seams (down-only — a base pkg NEVER imports an edition; ADR-0003/0022)

- `@caisson/registry` — `assertKnownModule`/`assertKnownVersion`, `loadRegistryIndexFromFile`,
  `moduleAllowlist`, `scripts/build-index.ts`, `ledger.jsonl`, `index.json` (ADR-0021/0047).
- `packages/cli/src/{generate,meter}.ts` — `Selection`, the `GeneratorEngine` + `FileSetWriter` seam
  types, `runGeneration` (debit-before-spend, 402 aborts with nothing written; ADR-0048/0049).
- `@caisson/credits` (`debit`, `codegen_debit`) · `@caisson/tenancy-rls` (`withTenant`/`TenantExecutor`)
  · `@caisson/kernel` (`safeEqualFixed`, `parseStrict`, typed errors, `audit-chain` canonicalize).
- The generator composes editions by **registry slug**, never by importing an edition package.

## Exit gate (DONE = all true, run-and-read evidence)

1. `create-caisson` materializes a fixed selection into a temp dir through the real `FileSetWriter`
   (path-safe, atomic, refuses a non-empty target) and the file set **matches a golden fixture**; the
   generated repo carries its trimmed CI + golden fixtures + `AGENTS.md` and **no** registry/publish/
   standards-gate-authoring/eval-gate file (ADR-0072 boundary asserted in the golden).
2. PGlite integration test: the codegen debit fires **before** any byte is written; a 402 (short
   balance) aborts with **nothing on disk**; a same-`idempotencyKey` retry debits once and
   re-materializes; a `generation` audit row is recorded post-debit in the same `withTenant` txn.
3. The migration assembler merges a per-package fixture set into one ordered sequence + a single
   `schema_version` ledger, **byte-matching a golden**; the entitlement resolver expands an edition id
   → its index-derived member slug set (unit test).
4. The MCP `generate` path validates **id+version against the index** (not a flat string list), mints
   an idempotency key, drives `runGeneration` (debit + record), and returns the file set; the
   tool-registration seam gates every tool by the resolver-expanded entitlement, fail-closed/timing-safe.
5. All 10 base manifests + `cli` + `field-crypto` pass the standards gate; a **test-doubled**
   publish-and-index run (no live publish) appends to the ledger + rebuilds `index.json`
   **byte-identically**, in dependency-topological order; `--edition` degrades gracefully against a
   not-yet-published edition.
6. `bun install` clean · `bun run check`/`bun run gate` green · `bun test` green repo-wide · all
   goldens matched `BLESS` unset · depcruise down-only clean · **no live network/cloud/model/publish
   in CI** · PR open + CI green · no service restarted (no DEPLOY).
