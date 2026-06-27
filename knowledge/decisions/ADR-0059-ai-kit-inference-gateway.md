# ADR-0059 — AI-Kit metered-inference gateway backed by Vercel AI SDK v5

Status: accepted · 2026-06-27 (Wave-1 editions session, fork lock. Resolves the P3-1 metered-inference
chokepoint + its ADR-0022 Gate-2 collision.)

ADR-0011 binds "all inference routes through `ai-config`," but base `ai-config` is deliberately
pure-config / no-network — it RESOLVES a provider, it never calls one. AI-Kit's six features
(metering, spend-cap, prompt-render, input/output guardrails, usage reconcile) each hang off the
provider call, so unless that call has one owner those mechanisms are hoped-for, not enforced.

## Decision

**AI-Kit ships a single inference gateway — `infer(lane, messages, opts)` — the one chokepoint all
six features layer on.** This is the call-side that makes ADR-0011's "all inference routes through"
real; it **implements ADR-0011 as an enforced chokepoint** and **interacts with ADR-0022 Gate-2**.

- **One ordered pipeline, one place enforcement lives:** `resolve(ai-config)` → `render` →
  `input-guard` → `cap/credit-check` → provider call → `record usage` → `output-guard` →
  `reconcile`. This is the ONLY site where metering, caps, and guardrails are enforced — not a
  primitive a buyer is trusted to wire correctly around their own call site.
- **Backed by Vercel AI SDK v5 (Apache-2.0).** `createProviderRegistry` maps ~1:1 onto `ai-config`'s
  lane map; `wrapLanguageModel` middleware (`transformParams` / `wrapGenerate` / `wrapStream`) is the
  documented seam where metering / cap / guardrails compose; streaming, tool-calling, and
  usage-normalization come for free instead of being hand-rolled.
- **The gateway interface stays thin enough to swap the backing SDK later** — the SDK is an
  implementation detail behind `infer(...)`, same swappability ethos as the `AeadCipher` seam
  (ADR-0045).
- **ADR-0022 Gate-2 carve-out (provider-SDK boundary):** the provider-SDK imports + calls are
  confined to the AI-Kit gateway package as a **documented, lint-sanctioned carve-out** (the
  `PROVIDER_EXEMPT` allow-set already names `ai-config` + `ai-kit`). This is the **call-side**,
  distinct from base `ai-config` which only RESOLVES config and makes no network calls — no new base
  `InferenceClient` port is forced down into `ai-config`, so the locked Wave-0 base stays no-network.
- **License clears both gates:** Apache-2.0 is consumable. The fully-commercial posture (ADR-0023,
  with the former Local-first AGPL flank now also commercial per ADR-0050) strips Apache / MIT only
  from Caisson's OWN-module SPDX allowlist; the ADR-0022 AGPL gate bars only AGPL contamination — an
  Apache-2.0 dependency trips neither.

## Rejected

- **Standalone buyer-assembled primitives** (metering, guards, render shipped loose for the buyer to
  wire around their own SDK call) — metering reliability then depends on buyer discipline, reopening
  the runaway-loop overspend gap ADR-0007 exists to close, and it cannot enforce ADR-0011's
  route-through invariant. The whole point is enforcement, not a toolkit.
- **Hand-rolled provider adapters** — rebuilds, worse, exactly what the AI SDK already ships
  (streaming, tool-calling, per-provider usage-normalization, the middleware chain).
- **LiteLLM** (Python proxy) — conflicts the Bun-only control plane; a second runtime at the core.
- **OpenRouter as the universal gateway** — collapses every provider behind one vendor, defeating
  the provider-agnosticism + BYOK that ADR-0011 is built to guarantee.

## Binding

All AI-Kit inference flows through the single `infer(lane, messages, opts)` gateway; no feature
(metering, spend-cap, prompt-render, input/output guardrails, usage reconcile) bypasses it, and the
ordered pipeline is the sole place those are enforced. Provider-SDK imports live only inside the
AI-Kit gateway package (and base `ai-config` for resolution-only), keeping ADR-0022 Gate-2 green; the
backing SDK stays hidden behind the `infer(...)` signature so it remains swappable. Evidence:
ADR-0011 (provider-agnostic `ai-config`, "all inference routes through"); ADR-0022 Gate-2 +
`boundaries.js` `PROVIDER_EXEMPT` / `.dependency-cruiser.cjs` (provider-SDK confined to
`ai-config` | `ai-kit`); ADR-0007 (debit-before-spend / runaway-loop circuit-breaker); ADR-0023 +
ADR-0050 (Apache-2.0 consumable under fully-commercial); AI SDK v5 `wrapLanguageModel` /
`createProviderRegistry` docs; `outputs/research/wave1-forks.md` (P3-1, X-9).
