# @caisson/ai-kit

The **AI Production Kit** edition (ADR-0059): one metered-inference gateway — `infer(lane, input,
opts)` — that is the enforced chokepoint for every AI feature. It composes the four base primitives
behind Vercel AI SDK v5, so a buyer's shipped app gets cost control, reproducible prompts, fail-closed
content safety, and a quality gate **by construction**, not by discipline.

- **Layer:** edition (`editions: ["ai-kit"]`) — a composition, never a fork (ADR-0003).
- **Composes:** `@caisson/prompt-registry` (resolve + render), `@caisson/ai-meter` (reserve /
  reconcile + caps / breaker), `@caisson/guardrails` (moderation + PII), `@caisson/ai-config`
  (lane → provider).
- **Key ADRs:** ADR-0059 (gateway), ADR-0060 (metering), ADR-0061 (prompts), ADR-0063 (guardrails),
  ADR-0011/0022 (the provider-SDK boundary — this is the **only** package that imports `ai` / `@ai-sdk/*`).

## Pipeline (fixed, fail-closed)

```
resolve → render → input-guard → reserve (cap/credit 402) → provider call → record usage →
output-guard → reconcile
```

The backing model is **injected** (`opts.resolveModel`) — production wires a `createProviderRegistry`
over the ai-config lanes (`buildRegistryResolver` + `defaultProviders`); CI injects a mock
`LanguageModelV2`, so no live model/network call happens in the gate. See `AGENTS.md` for the usage
contract + invariants.
