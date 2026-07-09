# SPEC — Wave 1: shared base layer

Act 1 (SPEC) of the 7-act cycle for the Wave-1 **shared base layer** — the new base packages +
cross-cutting contracts that **SHIP BEFORE every edition** (Compliance · AI-Kit · Local-first AI ·
Agentic-Dev compose these). Bound by the ADRs cited below (locked; do not relitigate). Source
research: `outputs/research/wave1-forks.md` (now superseded by the ADRs).

## Goal

Build the **shared layer the four Wave-1 editions stand on**: two NEW base packages
(`@caisson/agent-kernel`, `@caisson/local-store`) plus six cross-cutting contracts that extend
EXISTING base packages (migration assembler, entitlement-expansion resolver, base EventSink +
shared observability schemas, the generic credit event-type extension, the buyer-MCP
tool-registration seam, the local file-per-tenant isolation floor), and the uniform-commercial
licensing reconcile. Every piece ships green through the one `tooling/` standards gate
(manifest + AGENTS.md + golden + down-only depcruise) so each edition can start in an isolated
worktree without re-deriving any of it. **No edition feature code here** — only the floor editions
compose down-only.

## Tags

`infra` (migration assembler · CI down-only graph · new-package gate rows) · `billing` (the credit
event-type extension) · `security` (per-tool entitlement gating · local file-per-tenant isolation ·
EventSink redaction). Drives the SHIP-time conditional audits: **SECURITY audit** fires;
**infra review** for the assembler + the down-only graph additions. Test-doubled `secrets` /
`external-system` seams (OTel export, KMS) carry no live CI call.

## Scope (WHAT)

**Creates**

- `packages/agent-kernel/` — `@caisson/agent-kernel` (`kind: base`): agent/skill/rule Zod schema +
  lifecycle FSM + hooks dispatcher (ADR-0065). dep `@caisson/kernel` only.
- `packages/local-store/` — `@caisson/local-store` (`kind: base`): sqlite-vec (vec0) + FTS5 + RRF
  hybrid retrieval, FTS-degrade floor (ADR-0067); `src/tenant-db.ts` file-per-tenant resolver
  (ADR-0073). dep `@caisson/kernel` only.
- `packages/kernel/src/event-sink.ts` + `packages/kernel/src/observability.ts` — base `EventSink`
  port + shared evidence-pack/usage-metering/eval-result schemas (ADR-0075).
- `packages/kernel/src/migration-assembly.ts` — pure topo-merge + single `schema_version` checksum
  ledger algorithm (ADR-0070); `packages/cli/src/migrate/assemble.ts` — the compose-time driver +
  runner seam.
- `registry/schema/entitlements.ts` — edition/bundle → member-slug resolver (ADR-0071);
  `registry/schema/feature-tags.ts` — the registered feature-tag set (ADR-0074).

**Extends**

- `registry/schema/module-manifest.ts` + `packages/local-ai/package.json` — uniform-commercial
  reconcile (ADR-0050): SPDX allowlist → commercial-only, drop the AGPL⟺local-ai refine, AGPL gate
  stays a dormant tripwire.
- `packages/credits/src/{credits,schema}.ts` — generic `feature_debit`/`feature_grant` + validated
  `feature` tag (ADR-0074).
- `packages/mcp-server/src/server.ts` — hard `switch` → tool-registration seam + per-tool
  entitlement gating (ADR-0076).
- `packages/kernel/src/index.ts` (export the new ports/schemas); `.dependency-cruiser.cjs` BASE_PKGS
  - `@caisson/standards-gate` workspace list (+ agent-kernel, local-store).

**OUT of scope:** edition feature code (no compliance/ai-kit/local-ai/agent-dev edition bodies — they
compose this); the edition-specific MCP tool BODIES (`explain_control`/`run_eval`/kernel-introspect
live in their editions — only the seam + base tools here); the registry **backfill/publish** of the
two new packages (P5); per-package migration adoption of existing inline DDL (each lands in its
edition wave); live cloud/model/network in CI (KMS + OTel export are test-doubled seams); DEPLOY
(SHIP stops at the merged PR).

## Locked decisions implemented

| ADR  | Requires in code                                                                                                                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0050 | SPDX allowlist = `["LicenseRef-Caisson-Commercial"]`; drop AGPL⟺local-ai refine; `oss` tier dead; `local-ai` package.json → commercial; AGPL gate kept as a dormant CI tripwire.                                                      |
| 0065 | NEW base `@caisson/agent-kernel` owns the agent/skill/rule schema + lifecycle FSM + hooks dispatcher; consumable base→base (cli/mcp-server) + edition→base (agent-dev); never imports an edition.                                     |
| 0067 | NEW base `@caisson/local-store`: raw `bun:sqlite` over vec0 (FLOAT[N]) + FTS5, RRF_K=60 merge when embeddings exist, degrade to FTS5-only on a missing/failed vec leg; embedding stays a seam.                                        |
| 0070 | Each package owns numbered forward-only `migrations/NNNN_*.sql`; a base assembler topo-merges by the dep DAG into ONE renumbered sequence + ONE `schema_version` checksum ledger (ADR-0014); no edition/package owns global ordering. |
| 0071 | Resolver expands a purchased edition/bundle id → member-module slug set by reading the registry index `editions[]`; bundle = base + all editions; membership derived from the index ONLY, never token-baked.                          |
| 0073 | Local tier isolates tenants by ONE SQLite DB file per tenant; the resolved path IS the boundary, derived server-side from an authenticated `tenant_id`, traversal-guarded; field-crypto keys stay per-tenant-derived.                 |
| 0074 | Base `credits` adds generic `feature_debit`/`feature_grant` carrying a Zod-`.strict()` validated `feature` tag (fail-closed on an unregistered tag); legacy event types immutable; idempotency key unchanged (tag is payload).        |
| 0075 | Base `EventSink` port (OTel→Postgres, swappable) is the one operational-telemetry contract; evidence-pack/usage/eval schemas live in one shared base home; redaction once at the sink; WORM audit-chain stays strictly separate.      |
| 0076 | Buyer MCP exposes a tool-registration seam (not a switch); every tool declares + timing-safe re-validates its required entitlement; base generation tools remain (credit-gated); edition tools register additively.                   |

## Consumed seams (down-only; a package never depends up on an edition — ADR-0003/0022)

`packages/kernel/src/{index,errors,audit-chain}.ts` (the shared base lib + the ADR-0019 error/redaction
model the sink reuses + the ADR-0052 chain that stays separate) · `packages/credits/src/{credits,schema}.ts`
(`GRANT/DEBIT_EVENT_TYPES`, the `credit_event` ledger + `(account_id, idempotency_key)` index) ·
`packages/mcp-server/src/server.ts` (the `handleToolCall` switch + `entitlements: ReadonlySet<string>`) ·
`packages/tenancy-rls/src/rls.ts` (`withTenant` / `buildTenantPolicySql` — the Postgres-tier boundary
ADR-0073 mirrors per-tier) · `registry/schema/{module-manifest,registry-index}.ts` (`editions[]`,
`moduleAllowlist`, `loadRegistryIndexFromFile`) · `tooling/` (`@caisson/standards-gate` + the down-only
`.dependency-cruiser.cjs` + `testing/golden-module.ts`). Pro-private firewall: `@caisson/local-store` is
rebuilt clean from the PUBLIC gridwork-core `memory-vec.ts` `hybridSearch` PATTERN only — never
media-pipeline implementation.

## Exit gate

`bun install` clean; `bun run gate` green (both new manifests↔package.json agree; down-only depcruise
incl. agent-kernel + local-store); `bun run check` green; `bun test` green repo-wide; all goldens
matched with `BLESS` unset. Per-contract:

- **agent-kernel** drives a fixed lifecycle transition trace matching its golden; an illegal transition
  throws; the schema round-trips; `cli`/`mcp-server` import it base→base with no base→edition edge.
- **local-store** returns the golden RRF ranking for a fixed `(vectors, FTS docs, query)` input; with the
  vec leg removed it degrades to FTS5-only and still returns results; never imports an edition.
- **ADR-0073:** opening tenant A's resolved file cannot return tenant B's rows; a `..`/null-byte/absolute
  `tenant_id` is rejected before any open.
- **ADR-0074:** a registered-tag `feature_debit` debits integer credits idempotently; an unregistered tag
  fails closed with no ledger write; legacy event types unchanged.
- **ADR-0071:** expanding a purchased edition id yields exactly the index `editions[]` member set (golden);
  the bundle = base + all editions; an unknown purchased id fails closed.
- **ADR-0075:** an emitted event carrying a secret/SQL/stack is redacted at the sink (test); compliance
  evidence is NOT routable through the sink (asserted separate path).
- **ADR-0076:** a registered edition-scoped tool is denied (timing-safe) and invisible to a non-entitled
  caller; base generation tools work + keep the `generate` credit re-check.
- **ADR-0070:** the assembler merges two package migration sets into ONE deterministic renumbered sequence
  - ONE `schema_version` checksum matching the golden; a re-run is byte-identical.
- **ADR-0050:** every manifest validates under the uniform-commercial model; no AGPL/oss/permissive license
  validates; the AGPL tripwire still hard-fails a re-introduced AGPL dep.

PR open + CI green; no service restarted.
