---
phase: ai-sdk-v7-migration
project: caisson
issue: CAISSON-106
created: 2026-07-13
status: draft
lock_gate: operator
tags: [ai, billing]
---

# Goal

Move Caisson's metered AI SDK implementation from v5 to v7 through a verified v6 checkpoint while preserving the gateway boundary, exact credit accounting, provider behavior, and eval quality.

## Acceptance Criteria

1. `ai` reaches v7 only after a committed, green v6 checkpoint, with the version-specific v6 and v7 codemods reviewed separately and no use of the all-versions `upgrade` codemod.
2. The seven direct `@ai-sdk/*` dependencies in `packages/ai-kit/package.json` move in lockstep to versions compatible with each checkpoint; no second provider SDK call site or unapproved direct dependency is introduced.
3. `infer`, `inferStream`, `embed`, and `embedMany` preserve their public Caisson contracts and their fixed order: resolve, render where applicable, guard where applicable, reserve, provider call, record usage, output guard where applicable, reconcile.
4. Every paid provider call still reserves integer credits before network work, reconciles exactly once against actual reported usage, settles a completed call with unreported usage at the reservation, refunds a failed call, and never leaks a reservation on stream abandonment.
5. AI SDK v7 usage details, including cache-read tokens and all-step totals, normalize into the internal `Usage` shape without double-counting, float math, negative values, or treating missing usage as zero.
6. A committed golden fixture covers normal, cached-input, zero, unreported, failed, streamed, abandoned-stream, and embedding usage cases and proves the resulting integer credit ledger outcomes.
7. The provider registry continues to resolve every configured lane; OpenRouter, local, Ollama, Groq, Mistral, and Together stay on the OpenAI-compatible chat-completions transport; Azure, Bedrock, Anthropic, Google, and OpenAI keep their intended factories; every outbound provider fetch retains `fetchWithTimeout`.
8. `packages/ai-config`, `apps/ai-kit`, `packages/local-ai`, and `services/intel` are explicitly checked for compatibility; surfaces with no direct AI SDK dependency remain unchanged unless a compile, test, or eval failure proves a required edit.
9. `bun run eval` passes against the ADR-0062 committed baselines without `BLESS`; a baseline change, prompt change, or judge-output change stops the migration for a separate operator decision.
10. Package builds, tests, lint, the standards gate, the full workspace check, source-of-truth checks, and the provider-boundary checks are green, and every changed `packages/*` workspace has a naming changeset.

## Context

- Linear runbook: [CAISSON-106](https://linear.app/gridworkdev/issue/CAISSON-106) requires two supported hops, provider lockstep, full gates, and an eval rerun.
- Gateway authority: `knowledge/decisions/ADR-0059-ai-kit-inference-gateway.md` makes `@caisson/ai-kit` the sole metered inference chokepoint and hides the backing SDK behind Caisson APIs.
- Money authority: `knowledge/decisions/ADR-0060-ai-kit-metering-spendcap.md` binds estimate, reserve, and reconcile to the append-only credit ledger in integer units.
- Eval authority: `knowledge/decisions/ADR-0062-ai-kit-eval-harness-ci-gate.md` requires regression against a committed baseline and an explicit bless for any accepted baseline movement.
- Embedding authority: `knowledge/decisions/ADR-0213-ai-kit-metered-embeddings.md` routes buyer-facing embeddings through the same metering chokepoint.
- Current package inventory: `packages/ai-kit/package.json:24-41`; the reference app's provider type dependency is `apps/ai-kit/package.json:15-16`.
- Current usage adapter: `packages/ai-kit/src/gateway.ts:202-215`; provider calls and result consumption: `packages/ai-kit/src/gateway.ts:316-369` and `packages/ai-kit/src/gateway.ts:512-601`; embeddings: `packages/ai-kit/src/embed.ts:94-126`.
- Current provider construction and compatibility routing: `packages/ai-kit/src/providers.ts:18-221`; chat-completions regression coverage: `packages/ai-kit/src/providers.test.ts:150-230`.
- Metering regression coverage: `packages/ai-kit/src/gateway.test.ts:298-330`, `packages/ai-kit/src/gateway.test.ts:520-596`, `packages/ai-kit/src/gateway.integration.test.ts:222-435`, and `packages/ai-kit/src/embed.test.ts:162-180`.
- Official migration sources: [AI SDK 5 to 6](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0), [AI SDK 6 to 7](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0), and [AI SDK codemods](https://github.com/vercel/ai/tree/main/packages/codemod).
- ADR ceiling is 0329 on current `main`; this migration executes existing locks and does not require a new ADR unless execution exposes a genuine product or money-policy fork.

## Current and Target Dependency Contract

The repository has seven direct provider packages, but the Linear description names `provider-utils` and `react` instead of the direct Bedrock and Azure adapters.

**Recommendation for operator lock, high confidence:** define “seven provider-package majors” from the checked-in direct inventory below, keep `@ai-sdk/provider-utils` transitive, and do not add `@ai-sdk/react` unless an actual source import is introduced. This matches the enforced provider boundary and avoids dependency growth based on a stale issue list.

| Direct package              |    Current | v6 checkpoint family |    v7 final family |
| --------------------------- | ---------: | -------------------: | -----------------: |
| `ai`                        | `^5.0.206` |             `^6.0.0` |           `^7.0.0` |
| `@ai-sdk/amazon-bedrock`    |  `^3.0.99` |   v6-compatible `^4` | v7-compatible `^5` |
| `@ai-sdk/anthropic`         |  `^2.0.83` |   v6-compatible `^3` | v7-compatible `^4` |
| `@ai-sdk/azure`             | `^2.0.114` |   v6-compatible `^3` | v7-compatible `^4` |
| `@ai-sdk/google`            |  `^2.0.76` |   v6-compatible `^3` | v7-compatible `^4` |
| `@ai-sdk/openai`            | `^2.0.109` |   v6-compatible `^3` | v7-compatible `^4` |
| `@ai-sdk/openai-compatible` |   `^1.0.0` |   v6-compatible `^2` | v7-compatible `^3` |
| `@ai-sdk/provider`          |   `^2.0.3` |   v6-compatible `^3` | v7-compatible `^4` |

Exact patch versions are resolved and recorded from the official `ai-v6` and `latest` dist-tags at execution time; peer ranges and a single resolved `@ai-sdk/provider` line must be proven in `bun.lock` before each checkpoint commit. The family matrix above was checked against the npm registry dist-tags on 2026-07-13.

## Scope

- **In scope:** `packages/ai-kit` dependency, provider, registry, inference, streaming, embedding, mock, live-test, documentation, and usage-accounting surfaces; the `apps/ai-kit` provider type seam; compatibility checks for `packages/ai-config`, `packages/local-ai`, and `services/intel`; lockfile updates; golden usage accounting; naming changesets; eval and full gates.
- **Out of scope:** changing Caisson's public gateway signatures; adding providers, React hooks, tools, agents, prompts, pricing rows, or credit policy; changing Zod v4; editing `packages/cli/templates/**`; blessing eval or golden drift without operator approval; modifying provider webhook schemas; deploying or publishing packages.

## Behavioral Constraints

1. Version-specific codemods run only against the inventoried AI SDK files and are reviewed before any manual fix.
2. The v6 checkpoint must be independently buildable, testable, and committable; v7 work does not begin on a red v6 tree.
3. AI SDK v7's top-level `usage` is the all-step total and remains the billing source. `finalStep.usage` must not replace it in the metered path.
4. AI SDK v7's nested cache-read usage replaces the deprecated flat cached-token field and is clamped to input tokens before price-book calculation.
5. `StreamTextResult.stream` replaces the deprecated `fullStream` access, while the terminal finish part's total usage remains the actual settlement input.
6. The codemod output must not introduce `zod/v3`, CommonJS, raw `fetch`, `AbortSignal.timeout`, or provider imports outside the sanctioned boundary.
7. An eval regression, golden-money mismatch, provider transport change, new direct dependency, or required pricing change is a lock-stop, not an implementation judgment.

## Tag Rationale

- `ai`: this is a model SDK and provider migration that changes inference, streaming, embedding, and eval-sensitive behavior; Act 6 eval is mandatory.
- `billing`: provider usage drives reserve and reconcile against the credit ledger, so usage-shape changes are a money seam and require the security audit lane.

## Operator Lock

Locking this SPEC accepts the direct-dependency matrix recommendation and authorizes only the migration described here. Until that lock, `status` remains `draft` and no AI SDK migration product code may be written.
