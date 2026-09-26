# @caisson/ai-kit

The **AI Production Kit** edition (ADR-0059/0213): one metered gateway with four public entry points—
`infer`, `inferStream`, `embed`, and `embedMany`—that enforce reserve-before-provider-call accounting.
It composes the four base primitives behind Vercel AI SDK v7, so a shipped app gets cost
control, reproducible prompts, fail-closed content safety, and a quality gate **by construction**,
not by discipline.

- **Layer:** edition (`editions: ["ai-kit"]`) — a composition, never a fork (ADR-0003).
- **Composes:** `@caisson/prompt-registry` (resolve + render), `@caisson/ai-meter` (reserve /
  reconcile + caps / breaker), `@caisson/guardrails` (moderation + PII), `@caisson/ai-config`
  (lane → provider). The provider-SDK boundary (ADR-0011/0022) makes this the **only** package
  that imports `ai` / `@ai-sdk/*`.

## Pipeline (fixed, fail-closed)

```
resolve → render → input-guard → reserve (cap/credit 402) → provider call → record usage →
output-guard → reconcile
```

The backing model is **injected** (`opts.resolveModel`) — production wires a `createProviderRegistry`
over the ai-config lanes (`buildRegistryResolver` + `defaultProviders`); CI injects a mock
`LanguageModelV4`, so no live model/network call happens in the gate. See `AGENTS.md` for the usage
contract + invariants.

Every accepted system-role message retains its exact position through AI SDK v7's explicit
`allowSystemInMessages` compatibility switch, preserving the public raw-message contract. Billing
uses the all-step usage total. Completed language calls with malformed or ledger-unsafe provider
usage fall back to a ledger-safe reservation or consumed estimate without refunding below the
reservation; embeddings instead use a deterministic input-only estimate and refund the phantom
output reservation. Valid nested cache-read tokens retain their discount, and reported zero remains
distinct from unreported usage. `inferStream()` starts its provider pump eagerly and exposes both a
gateway-owned async `textStream` and a `settled` promise, so dropped or never-consumed iterators still
reconcile exactly once.

## Metered embeddings (ADR-0213)

`embed()`/`embedMany()` join `infer()`/`inferStream()` through the SAME reserve-before/
reconcile-after chokepoint — a shorter pipeline (`resolve → reserve → provider call → record usage →
reconcile`, no prompt-registry render, no guardrails) for a user-facing RAG/semantic-search surface.
Every live provider factory also binds its outbound `fetch` to a `timeoutMs` deadline
(`fetchWithTimeout`, default 60s), and `infer()` forwards an `abortSignal` to `generateText` — closing
the repo-wide fetch-deadline floor on the live provider transport. See `AGENTS.md` for usage.
