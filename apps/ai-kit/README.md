# apps/ai-kit

The **AI Production Kit** reference app. A thin Next.js
App-Router wiring shell that drives the `@caisson/ai-kit` `infer()` gateway end-to-end, composing
the four base primitives (prompt-registry · ai-meter · guardrails · ai-config) behind one metered
chokepoint.

It runs entirely **locally**: an embedded PGlite store (the production fail-closed-RLS shape, no
Docker, no network) and a test-doubled model. **Zero provider secret, zero network egress** — the
live transport is the only path a buyer wires last.

## What it demonstrates

- **coach-configure a lane** (ADR-0076) — the setup coach proposes + validates an AI lane and emits
  env-var NAMES + a `.env.example`, never a secret value.
- **metered** — resolve a prompt by `name@version` → render → reserve BEFORE the call → reconcile to
  actual; the wallet settles to the real charge.
- **cap** — a hard per-tenant spend cap trips the circuit breaker; the next call returns **402**
  before the provider is reached.
- **guardrail** — a flagged input fails closed: **GuardrailError 422**, the model is never called, no
  spend, and a metadata-only `guardrail.blocked` event reaches the `EventSink`.
- **empty wallet** — reserve-before-spend → **402** before the model is reached.

## Run

```sh
bun run dev     # http://localhost:3031
bun run build   # production build
bun test ./lib  # wiring smoke (mock provider, no network)
```

A buyer swaps the injected mock model for `buildRegistryResolver` over the real `@ai-sdk/*`
adapters and points the transactor at their Postgres — the gateway code above is unchanged.
