# VERIFY — AI SDK v7 lockstep migration

## Goal

Move Caisson's metered AI SDK implementation from v5 to v7 through a verified v6 checkpoint while
preserving the gateway boundary, exact credit accounting, provider behavior, and eval quality.

## Verdict: PASS

The branch reaches AI SDK v7 through a distinct green v6 commit, keeps the metered Caisson API and
integer ledger behavior stable, preserves every provider transport, and passes the committed eval,
workspace, standards, and source-of-truth gates.

## Criterion-by-criterion

1. **Two-hop migration — pass.** Commit `3d05491c` is the independently built, tested, linted,
   evaled, and standards-gated v6 checkpoint; commit `ab0de8e7` is the later v7 migration. The v6
   and v7 version-specific codemods were invoked separately. The wrapper's `--dry` mode mutated its
   scoped files, so each contained diff was reviewed as the one codemod output; the all-version
   `upgrade` command was never used.
2. **Dependency lockstep and boundary — pass.** `packages/ai-kit/package.json:25`-`40` contains the
   accepted v7 families and `apps/ai-kit/package.json:16` aligns on provider v4. `bun.lock` resolves
   exactly `ai@7.0.22` and one `@ai-sdk/provider@4.0.3`; provider-utils remains transitive and React
   remains absent. The import inventory and ESLint boundary tests keep SDK imports on the accepted
   AI surfaces.
3. **Public gateway contract and order — pass.** `infer`, `inferStream`, `embed`, and `embedMany`
   retain their exported Caisson signatures. `packages/ai-kit/src/gateway.ts:265` and
   `packages/ai-kit/src/embed.ts:126` preserve resolve/guard/reserve/provider/reconcile order, and
   the full gateway/embedding integration suites pass.
4. **Money invariants — pass.** The tests cover reserve-before-call, exactly-once reconciliation,
   completed-but-unreported settlement at reservation, provider-failure refund, abort/error paths,
   and abandonment without a leaked reservation. The stream idempotency proof is at
   `packages/ai-kit/src/gateway.test.ts:1032`.
5. **v7 usage normalization — pass.** `packages/ai-kit/src/usage.ts:33` clamps all reported fields to
   finite non-negative integers, caps cache reads at input, and keeps missing usage distinct from
   reported zero. Non-streaming billing reads v7 all-step `result.usage` at
   `packages/ai-kit/src/gateway.ts:357`; streaming reads terminal `finish.totalUsage` at line 609.
6. **Accounting golden — pass.** `packages/ai-kit/src/__golden__/usage-accounting.json` covers normal,
   cached, zero, unreported, failed, finished-stream, abandoned-stream, and embedding outcomes.
   The non-BLESS v6 and v7 runs match it byte-for-byte; no ledger integer or row count moved.
7. **Provider behavior — pass.** The table-driven matrix at
   `packages/ai-kit/src/providers.test.ts:59` proves all 11 configured backends' exact provider/model
   identity, endpoint, chat-versus-Responses choice, and injected bounded fetch. Azure stays on
   `azure.chat`; OpenRouter/local/Ollama/Groq/Mistral/Together stay on chat completions. Four
   credential-gated OpenRouter live tests passed for chat, streaming, embed, and embedMany.
8. **Adjacent compatibility — pass.** `packages/ai-config`, `packages/local-ai`, and
   `services/intel` build without source changes; `apps/ai-kit` builds and its seven tests pass on
   `LanguageModelV4`. No SDK import was added to an adjacent package.
9. **Eval quality — pass.** `bun run eval` completed four eval tasks successfully without `BLESS`;
   the ADR-0062 baseline has no diff.
10. **Release and repository gates — pass.** `bun run check`, `bun run gate`, `bun run sot`, and
    `git diff --check` exit zero. `.changeset/ai-sdk-v7-migration.md` names the one changed
    publishable package, `@caisson/ai-kit`, at patch level. SOT confirms ADR ceiling 0329, package
    counts, archive integrity, branch hygiene, and changeset preflight are green.

## Forbidden-surface proof

No `packages/cli/templates/**`, webhook schema, price-book row, eval baseline, Zod dependency,
daemon, route, port, MCP, or deployment file changed. No baseline was blessed after the initial v5
characterization fixture was inspected.

## Fresh command evidence

- `bun run check` — pass across the workspace; standards gate green.
- `bun run eval` — 4 successful eval tasks, no baseline movement.
- `bun run sot` — green, no source-of-truth drift.
- Focused provider/BYOK/gateway/embed suite — 86 pass, 0 fail.
- Full `@caisson/ai-kit` suite — 108 pass, 0 fail in the workspace check.
- OpenRouter live seam — 4 pass, 0 fail.
- `git diff --check` — pass.
