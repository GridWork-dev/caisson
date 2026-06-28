# SPEC — Wave 1 · P3: AI Production Kit

Act 1 (SPEC) of the 7-act cycle for the Wave-1 **AI Production Kit** edition. Bound by the locked
ADRs cited below (do not relitigate). Source brief: `plan.md §P3`; research input:
`outputs/research/wave1-forks.md §P3-ai-kit` (25 forks, all locked). Composes the Wave-0 shared
substrate; ships green through the single `tooling/` standards gate.

## Goal

Build the **AI Production Kit edition: one metered-inference gateway (`infer()`) that is the enforced
chokepoint for every AI feature** — token metering, hard spend caps + a runaway-loop circuit breaker,
a versioned injection-safe prompt registry, a guardrails layer (moderation + PII redaction), and an
eval harness gated in CI against a committed baseline — plus an agent-assisted setup coach. WHY: a
buyer's shipped app gets enforced cost control, reproducible prompts, fail-closed content safety, and
quality regression gating **by construction**, not by buyer discipline — the production-rigor half of
the hero umbrella (ADR-0040). VERIFY re-asks: does a metered `infer()` call reserve-before-spend,
reconcile to actual, hard-cap with a 402 breaker, redact PII fail-closed, resolve a prompt by
`name@version`, and pass a regression-vs-baseline eval gate — all with a **test-doubled** provider
(zero live model/network calls in CI)?

## Tags

`ai` (gateway/prompts/agents/evals → EVAL fires) · `billing` (metering/credits/402/caps) ·
`security` (guardrails, PII, fail-closed, prompt-injection) · `external-system` (provider SDKs +
moderation backends). Drives the SHIP audits: **EVAL** (the eval gate itself) · **SECURITY** audit
(security/secrets/external-system). No new public `ui` surface beyond the thin reference app.

## Scope

**Creates (5 packages + 1 app):**

- `@caisson/ai-meter` — base **primitive** (paid): metering schema, estimate→reserve→reconcile,
  price book, atomic spend counter, soft/hard caps + circuit breaker (ADR-0060).
- `@caisson/prompt-registry` — base **primitive** (paid): append-only versioned prompts, `name@version`
  - mutable `alias→version` pointer, typed injection-safe templating (ADR-0061).
- `@caisson/guardrails` — base **primitive** (paid): `Moderator` port + PII redact/tokenize (ADR-0063).
- `@caisson/ai-evals` — base **primitive** (paid): `defineEval` harness + grader taxonomy +
  regression-vs-committed-baseline comparator (ADR-0062).
- `@caisson/ai-kit` — the **edition** (paid): the `infer(lane, messages, opts)` gateway backed by
  Vercel AI SDK v5, composing the four primitives; the ONLY package that imports a provider SDK
  (ADR-0059). Edition = composition, never a fork (ADR-0003).
- `apps/ai-kit` — Next.js App-Router (ADR-0044) reference app: the P3 exit artifact.

**Extends (down-only, base):** `@caisson/kernel` (the ADR-0075 `EventSink` port + the P3-owned shared
`usage-metering`/`eval-result`/`guardrail-block` schemas; `GuardrailError` 422 amending the ADR-0019
hierarchy) · `@caisson/credits` (the ADR-0074 generic `feature_debit`/`feature_grant` event types +
edition `feature` tag) · `@caisson/mcp-server` (coach tools via the ADR-0076 registration seam) ·
`tooling/eslint-config/boundaries.js` (`@ai-sdk/*` provider packages added to `PROVIDER_SDKS`,
confined to `ai-config`|`ai-kit`) · `turbo.json` + CI (a distinct `eval` task) ·
`registry/ledger.jsonl` (incremental backfill entries, ADR-0069).

**Out of scope / firewall:** per-tenant encrypted BYOK (P3-25 stays ai-config's locked env-pointer
contract — deferred fork) · the full P5 generation/MCP-drive (only the coach tool seam is real) · the
P6 dashboard/cost analytics UI · live provider/model/network calls in CI (every provider call is
test-doubled) · Presidio/NER + promptfoo red-team (deferred behind their ports, optional add-ons) ·
Pricing numbers (`priceCents` placeholders pending the operator lock) · any `media-pipeline`
seed (pro-private firewall — the moderation/PII taxonomy is built fresh; PUBLIC patterns only) · DEPLOY.

## Locked decisions → what each requires in code

| ADR                      | Requires in code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0059** gateway         | A single `infer(lane, messages, opts)` in `@caisson/ai-kit` backed by Vercel AI SDK v5 (`createProviderRegistry` over `ai-config` lanes; `wrapLanguageModel` middleware); ordered pipeline `resolve→render→input-guard→cap/credit-check→provider call→record usage→output-guard→reconcile`; the SDK hidden behind `infer()` (swappable); provider model **injected** (mock in CI). Provider-SDK imports live ONLY here (Gate-2 carve-out).                                                                                                                     |
| **0060** metering        | `estimate→reserve→reconcile` against the append-only `credit_event` ledger: a pre-call reservation `feature_debit` (402 on short wallet, call never fires) + a post-call reconcile leg (`feature_grant` refund / `feature_debit` shortfall), both idempotent on `(account_id, idempotency_key)`; per-tenant running spend mutates only via atomic `UPDATE…RETURNING`; provider cost normalized through a price book into **integer credit units** (never floats); soft/hard caps + a stored-state circuit breaker checked **before every reserve** (open→402). |
| **0061** prompt registry | Append-only immutable prompt versions (`supersedes_id` chain via `kernel/versioning.ts`); fetch by `name@version`; a mutable `alias→version` pointer (`prod`/`canary`) swappable with no redeploy; typed `.strict()` variable schemas rendered through an **escaping** boundary (no raw interpolation of untrusted input); each render links `version→usage→eval`.                                                                                                                                                                                             |
| **0062** eval gate       | `defineEval({data, task, scorers, threshold})` over `matchGolden`; grader taxonomy (deterministic + model-graded via a `Judge` port); datasets version-bound to a prompt version; gate = **regression vs a committed JSON baseline** (BLESS-style re-baseline) as a **distinct turbo `eval` task**, monorepo-only — **never a 7th required CI job in a generated buyer repo** (ADR-0072).                                                                                                                                                                      |
| **0063** guardrails      | Enforced at the gateway input/output points; a pluggable `Moderator` port (provider \| local \| custom, `forge.config`-selected); PII engine with mask/hash/**reversible-tokenize** reusing field-crypto `sealField`/`openField` (ADR-0055); **fail-closed** default + documented per-policy `failOpen`; `GuardrailError` 422; guardrail blocks emit to the ADR-0075 `EventSink` via a typed bus (never an up-import of the Compliance edition).                                                                                                               |

## Consumed seams (Wave-0 / shared — down-only, ADR-0003/0022)

- `packages/credits/src/credits.ts` + `schema.ts` — `debit()`/`grant()` atomic floor + 402 (`InsufficientCreditsError`) + the append-only `credit_event` ledger; the reserve/reconcile legs ride `debit`/`grant` (extended with ADR-0074 generic event types).
- `packages/ai-config/src/config.ts` — `resolveProvider(settings, lane)`; the gateway maps `createProviderRegistry` onto these lanes (no provider literal leaks past the resolver).
- `packages/field-crypto/src/column.ts` — `sealField`/`openField` (the sole reversible PII-tokenize path; never a bespoke crypto path).
- `packages/mcp-server/src/server.ts` — `handleToolCall` + `onGenerate`/entitlement seam; coach tools register through the ADR-0076 extensibility seam (timing-safe Bearer reused).
- `packages/kernel/src/{versioning.ts,errors.ts,fetch.ts,schema.ts}` — `supersedes`-chain versioning (prompts), the typed error hierarchy (`GuardrailError`/`InsufficientCreditsError`), `fetchWithTimeout`, `strictObject`/`parseStrict`; the ADR-0075 `EventSink` lands here as base.
- `packages/tenancy-rls/src/rls.ts` — `withTenant`/`TenantExecutor`/`buildTenantPolicySql`; every new table is FORCE-RLS in its migration (ADR-0014/0070).
- `tooling/` — the one standards gate: every new package ships a `manifest.ts` (`defineModule`) + golden dir + down-only graph entry; `bun run gate` is the single ingress.

## Exit gate (DONE = all green, no DEPLOY)

1. A metered `infer()` through the gateway (test-doubled `LanguageModelV2`): the reservation debits
   **before** the provider call; an empty/short wallet returns **402** and the call never fires; the
   reconcile leg trues to actual; a same-key retry settles once (integration test on PGlite).
2. A **hard** per-tenant spend cap **trips the circuit breaker** → the next reserve returns **402**;
   the spend counter is atomic under concurrency; cost normalizes to **integer credits** (golden).
3. A guardrail input/output block throws **`GuardrailError` 422 fail-closed** on moderator
   error/timeout; PII reversible-tokenize round-trips through field-crypto; a `failOpen` policy is
   honored only when explicitly set; the block emits a typed event to the `EventSink`.
4. A prompt resolves by `name@version`; swapping the `prod` alias changes the live prompt with **no
   code change**; an untrusted render var cannot escape its slot (injection test).
5. The **eval gate** passes regression-vs-committed-baseline as a distinct turbo `eval` task,
   cassette-replayed (no provider secret, no network), and is **absent** from a generated buyer repo's
   required CI (ADR-0072).
6. All 5 new packages green through `tooling/`: `bun run check` + `bun run gate` + `bun run eval`
   green; every golden matched with `BLESS` unset; the provider-SDK boundary confines `@ai-sdk/*` to
   `ai-kit` (a base package importing one fails the gate); each new locked package has a ledger
   backfill row; PR open + CI green; **no service restarted**.
