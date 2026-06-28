# ADR-0093 — Local `create-caisson` is free; codegen credit-debit scoped to the hosted path

Status: accepted · 2026-06-28 (operator lock, picker round) · clarifies the scope of ADR-0049
(codegen debit-before-spend). Composes on ADR-0049, ADR-0024, ADR-0005, ADR-0008.

## Context

`packages/cli/src/meter.ts`'s header asserted "Both `create-caisson` and the buyer MCP call
`runGeneration`" (debit-before-spend). That is **factually wrong for the local CLI**: `cli.ts:13` imports
only `generate` + `createFileSetWriter`; `runCli` (`cli.ts:180`) calls `generate(...)` directly with no
`withTenant`/`runGeneration`/debit, then writes via `createFileSetWriter()` and `git init` — a zero-credit
path. The local CLI has **no DB / tenant context** on the buyer's machine, so an offline credit debit is
impossible. Only the **hosted** buyer MCP debits (`server.ts:9-10` delegates to `onGenerate`, which wires
`runGeneration` inside `withTenant`).

## Decision

**The local `create-caisson` CLI stays free-local (no debit, no DB).** Its monetization is the
**license-gated package install** (`NODE_AUTH_TOKEN` in `.npmrc` against the private registry), not a
per-generation codegen credit. **ADR-0049's debit-before-spend applies to the HOSTED generation path only**
(the buyer MCP `generate` → `runGeneration` inside `withTenant`). The only required change is the false
`meter.ts:3-4` comment, corrected to scope `runGeneration` to the hosted path (done in this change).

## Rejected

- **Thin-client local CLI that authenticates + calls a hosted generate endpoint to debit per generation** —
  would require online auth + a new public API surface and **breaks offline use**, contradicting the
  offline-first generator design. The license-key model already monetizes the local path.

## Binding

- The local `create-caisson` CLI generates without a credit debit; it never calls `runGeneration` and needs
  no tenant/DB context. Monetization = the license-gated install.
- Codegen debit-before-spend (ADR-0049) is enforced on the hosted buyer-MCP path only; `runGeneration` +
  the credit ledger live behind `withTenant` server-side.
- The `meter.ts` seam comment reflects this scope (no claim that the local CLI debits).

Evidence: `packages/cli/src/cli.ts:13,180,195-196` (free local path, no debit); `packages/cli/src/meter.ts:3-4`
(the corrected comment); `packages/mcp-server/src/server.ts:9-10` (hosted delegates to `runGeneration`).
