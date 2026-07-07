# AGENTS — @caisson/cli (create-caisson)

Agent-facing contract for driving generation (the buyer's agent + the MCP generation path).

## Invariants (do not violate)

- **Allowlist BEFORE side effects.** Always go through `generate` / `runGeneration`: every module
  id + version is validated against the registry index (`assertKnownModule` / `assertKnownVersion`,
  slug regex re-asserted) **before any path is constructed or any subprocess spawned** (ADR-0021).
  Never build a path from an unvalidated id/version — a raw version string is a traversal surface.
- **Debit before spend.** `runGeneration` debits one `codegen_debit` credit **before** any file is
  written (ADR-0049/0007). A short balance throws `InsufficientCreditsError` (402) and nothing is
  written. Do not write first and bill later.
- **One idempotency key per generation.** Mint a UUID per generation and pass it as
  `idempotencyKey`. A retry with the same key debits **once** (ADR-0024) — safe to retry a failed
  generation without double-charging.
- **Run inside `withTenant`.** The debit + ledger are tenant-scoped (ADR-0005); pass the
  `TenantExecutor` from `withTenant`.

## Selection shape

```
{ projectName: <lowercase-slug>,
  edition?: "compliance"|"ai-production"|"local-first"|"agentic-dev"|"provenance"|"everything",
  modules: [{ id: "@caisson/<slug>", version: "<semver>" }, …] }
```

`edition` also accepts the legacy edition ids (`ai-kit`, `local-ai`, `agent-dev`) — Zod normalizes
them to their bundle id above at parse time (ADR-0257 single alias point, `@caisson/registry-schema`),
so a legacy and a new-vocabulary invocation produce the identical composition. Zod `.strict()`
rejects unknown fields. `projectName` is a strict slug (it becomes a directory at generation time —
no traversal).

## Out of scope (current release)

No buyer-MCP wiring, no topological backfill publish — those are a later generation phase. This
package ships the allowlist gate, the debit seam, the idempotency contract, and the disk writer
(`createFileSetWriter`), all fully tested.
