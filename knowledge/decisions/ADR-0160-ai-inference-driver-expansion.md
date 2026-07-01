# ADR-0160 — AI inference driver expansion (AWS Bedrock · Azure OpenAI · Ollama)

Status: accepted · 2026-07-01 · Stage-2 Stream C (task C5) · extends ADR-0059 (ai-kit gateway) +
ADR-0011 (provider-agnostic config); does NOT supersede either. Reserved range 0160–0169.

ADR-0059 locked the `ai-kit` gateway: one metered `infer()`/`inferStream()` chokepoint over a Vercel
AI SDK `LanguageModelV2`, with `packages/ai-kit/src/providers.ts` (`providerFor`) as the **single**
place in the package graph a vendor SDK may be imported (the Gate-2 boundary). ADR-0011 locked
`ai-config` as provider-agnostic: a lane names `{provider, model, apiKeyEnv, baseUrl?}` and ai-config
never reads the key value. Today the provider enum is `openai | anthropic | google | openrouter |
local` (`config.ts:11`). This ADR authorizes three more inference backends behind the same ports.
Append-only; supersede with a later ADR, never edit.

## Context

Caisson is deployed by buyers in **their** environment; a single-driver inference port caps which
clouds a buyer can run on. AWS Bedrock (enterprise AWS procurement), Azure OpenAI (enterprise Azure
procurement), and Ollama (the local-first edition's natural self-host backend) are the three highest-
value additions from the adapter-expansion inventory (`docs/state/adapter-expansion.md` §2C, formerly
advisory "ADR-0125" — this is its real number from Stream C's reserved range).

## Decisions

1. **Drivers plug in at the existing `providerFor()` switch as `ProviderV2` adapters — nothing else
   moves.** New `case`s in `ai-kit/providers.ts` construct the vendor adapter; the driver contract
   stays `LanguageModelV2`/`ProviderV2` from `@ai-sdk/provider`. `gateway.ts`, metering, guardrails,
   `ModelResolver`, `buildRegistryResolver` are untouched — a new driver is additive, never invasive.
   The Gate-2 invariant holds: `providers.ts` remains the ONLY SDK-import site (enforced by
   `tooling/eslint-config/boundaries.js` `PROVIDER_SDKS`, extended with the new `@ai-sdk/*` packages,
   confined to `ai-config|ai-kit`).

2. **Bedrock** — `@ai-sdk/amazon-bedrock` `createAmazonBedrock(...)`. Enum value `"bedrock"`. Streaming
   works through the SDK's `doStream` unchanged. Auth is SigV4, not a single bearer — see decision 4.

3. **Azure OpenAI** — `@ai-sdk/azure` `createAzure({ resourceName, apiKey, apiVersion })`. Enum value
   `"azure-openai"`. For this provider `cfg.model` addresses an Azure **deployment** id (not a raw
   model id); `apiVersion` is required. Both are carried on the config (decision 4).

4. **`ProviderConfig` grows an optional `region` + `apiVersion` pair; BYOK's "name the env var, never
   read the value" contract is preserved.** `ProviderConfigSchema` (`config.ts:10-15`) adds optional
   `region?` (Bedrock), `apiVersion?` (Azure), and `apiSecretEnv?` (Bedrock's secret-access-key env-var
   NAME — sibling to `apiKeyEnv`, which for Bedrock names the access-key-id env var). ai-config still
   never reads any key value; `providerFor` reads `process.env[cfg.apiKeyEnv]` /
   `process.env[cfg.apiSecretEnv]` at the edge, exactly as it reads the single key today. A lane may
   also lean on the AWS default credential chain (omit `apiSecretEnv` → the SDK resolves creds itself).
   Rejected alternatives: overloading `baseUrl` with URL-embedded region/version (opaque, un-Zod-able)
   and pushing all Bedrock config to raw `process.env` (breaks config-as-truth for one provider).

5. **Ollama is `"ollama"` — a self-documenting enum value that maps to the existing `local` branch, no
   new SDK, no new switch case.** Ollama serves an OpenAI-compatible `/v1` endpoint, so it is
   `createOpenAI({ baseURL, apiKey: "ollama" })` — identical to `case "local"`. The distinct enum value
   exists only so a buyer's `forge.config` reads `provider: "ollama"` (config-as-truth / telemetry)
   instead of the misleading `"local"`; both enum values fall through to the same branch.

6. **All three ship OFF by default / config-opt-in, live transport un-exercised in CI.** A lane must
   explicitly name the provider; no driver runs without a lane + creds, so merging changes zero runtime
   behavior. Per the package's zero-live-call invariant (ADR-0059) and the ADR-0064 stub convention,
   CI covers only **construction** (`providerFor` returns the right adapter type per enum value) — the
   live provider call stays the deliberately un-exercised seam. Follows the `field-crypto/kms.ts:228`
   "ship the port + a doc comment, wire the SDK when a buyer opts in" precedent.

## Tests

`providers.test.ts`: `providerFor` returns the expected adapter instance for `bedrock` / `azure-openai`
/ `ollama` given a minimal lane config (mock env), and `defaultProviders` builds one instance per
distinct provider across lanes. `config.test.ts`: `ProviderConfigSchema` accepts the new optional
`region`/`apiVersion`/`apiSecretEnv` fields and still `.strict()`-rejects unknown keys; a lane naming a
new provider round-trips through `parseAiSettings`/`resolveProvider`. No live model/network call.

## Deferred (not blocking)

- **local-ai `RentedTransport` drivers** (Surface B — the local-first edition renting Bedrock/Azure for
  its `complete`/`embed` seam via `rented-backend.ts:91`) — a smaller per-provider follow-up behind the
  already-fail-closed egress gate; not required to land the ai-kit gateway drivers.
- **Embedder drivers** for the new providers (`local-store/src/embedder.ts`) — a distinct port; the
  adapter-expansion doc's "already covered by inference expansion" is aspirational, not automatic.
- **Live-transport exercise** (real Bedrock/Azure/Ollama calls) — DEPLOY-class, operator-sequenced
  (Stream C fork C8, operator-locked defer 2026-07-01).

## Binding (carried from ADR-0059/0011)

The gateway stays the enforced metered chokepoint; the vendor SDK stays hidden behind `infer()`;
`providers.ts` stays the single SDK-import site; no provider is hardcoded — selection is always a
config change. New drivers inherit every one of these unchanged.
