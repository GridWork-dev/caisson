# AGENTS — @caisson/ai-kit

Agent-facing authoring/usage contract (ADR-0020 `agents`). What a generation agent or a buyer's app
must know to run AI features through the metered gateway. The AI Production Kit edition is one
function: `infer(lane, input, opts)` — the enforced chokepoint for every AI feature (ADR-0059).

## The one entry point

```ts
import { infer } from "@caisson/ai-kit";

const res = await infer(
  "chat", // an ai-config lane (provider + model)
  { promptRef: "support@prod", vars: { question } }, // OR { messages: [...] }
  { tx, accountId, settings, resolveModel, guard, meter, maxOutputTokens },
);
// res: { text, messages, promptVersionId, usage, reserved, reconciled, callId }
```

The pipeline is fixed and fail-closed, in this order:

`resolve → render → input-guard → reserve (cap/credit check) → provider call → record usage →
output-guard → reconcile`

## Invariants (do not violate)

- **The model is INJECTED (`opts.resolveModel`).** Production wires `buildRegistryResolver(settings,
defaultProviders(settings))` (a `createProviderRegistry` over the ai-config lanes); tests inject a
  mock `LanguageModelV4`. The Vercel AI SDK v7 is hidden behind `infer()` — never call a provider SDK
  directly. **This package is the ONLY one that may import `ai` / `@ai-sdk/*`** (ADR-0011/0022).
- **Reserve happens BEFORE the provider call.** A short wallet throws `InsufficientCreditsError` (402)
  and an open breaker throws `SpendCapError` (402) — in both cases the model is never called and
  nothing is written. Reconcile then trues the charge to the provider's ACTUAL usage.
- **Each meter leg runs in its own `withTenant` transaction.** Pass `opts.tx` (the tenant pool) — the
  gateway opens the resolve/reserve/reconcile scopes itself, so no DB transaction is held across the
  (slow) provider call. `accountId` is the RLS subject for every leg.
- **Idempotent on `callId`.** Omit it for a fresh uuid, or pass the SAME `callId` on a retry to settle
  exactly once. A failed provider call refunds the reservation; a blocked OUTPUT still reconciles the
  actual spend (the tokens were consumed) before the 422 surfaces.
- **Guardrails are fail-closed.** A moderator outage/timeout BLOCKS (`GuardrailError` 422) unless the
  policy explicitly sets `failOpen`. PII is redacted on the input leg, so the provider never sees raw
  PII; in `tokenize` mode the gateway restores it on the output (one PII slot per match within a
  single guarded message — keep untrusted PII to one turn).
- **Composition, never a fork (ADR-0003).** The edition imports base primitives
  (`ai-meter`/`prompt-registry`/`guardrails`/`ai-config`) — it never imports another edition.

## Prompts + cost

- Address a prompt by `name`, `name@<n>` (version), or `name@<alias>` (e.g. `prod`/`canary`) — swap
  the alias to change the live prompt with no redeploy. Untrusted `vars` are validated by the
  version's strict schema and escaped at render; they can only fill a content slot, never forge a role.
- Cost normalizes through `@caisson/ai-meter`'s versioned price book into **integer credits** (never a
  float). AI SDK v7's all-step usage is the billing source; nested
  `inputTokenDetails.cacheReadTokens` is clamped to input tokens, and unreported usage remains
  distinct from reported zero. `opts.meter` overrides the price book / denomination / scope / clock.
- Registry-authored system messages are passed through the trusted `instructions` channel. Raw
  caller-supplied system roles are not opted into `allowSystemInMessages` and fail closed.

## Metered embeddings (ADR-0213)

```ts
import { embed, embedMany } from "@caisson/ai-kit";

const one = await embed("embeddings", "some text", {
  tx,
  accountId,
  settings,
  resolveModel,
  meter,
});
// one: { callId, embedding, usage, reserved, reconciled }

const many = await embedMany("embeddings", ["a", "b"], {
  tx,
  accountId,
  settings,
  resolveModel,
  meter,
});
// many: { callId, embeddings, usage, reserved, reconciled }
```

Same chokepoint contract as `infer()` — reserve BEFORE the call, reconcile to actual, BYOK zeroes the
wallet — over a SHORTER pipeline: `resolve → reserve → provider call → record usage → reconcile`. No
prompt-registry render and no guardrails (an embed input feeds a vector index, not a moderated chat
turn — guardrails-on-embed is explicitly out of scope). `opts.resolveModel` is an
`EmbeddingModelResolver`; production wires `buildEmbeddingRegistryResolver(settings,
defaultProviders(settings))`. The reservation carries no `maxOutputTokens` — the resulting phantom
output-token estimate always refunds in full at reconcile, so a buyer is billed for input tokens only.

## Fetch deadline (ADR-0213)

Every live provider factory (`providerFor`/`defaultProviders`) binds its outbound `fetch` to a
`timeoutMs` deadline (default 60s) via `fetchWithTimeout` — a hung live call aborts instead of
blocking the process. Override per call: `providerFor(cfg, keyOverride, timeoutMs)`,
`defaultProviders(settings, timeoutMs)`, or `buildByokResolver({ …, timeoutMs })`. `infer()` also
forwards `opts.abortSignal` to `generateText` (parity with `inferStream`'s `streamText` wiring) — an
aborted call still settles via the existing refund path, never leaking the reservation.

## Out of scope

No per-tenant encrypted BYOK for embeddings pricing (the embed price-book row / a flat bulk-embed SKU
is cross-package money, deferred — see ADR-0213's open question); no input/output guardrails on embed
values; no live provider/model/network call in CI (the model is a port — test-doubled, `live/`
excepted). Streaming ships request/response first; the signature is async-iterable-ready.
