# @caisson/ai-config — agent usage note

Provides the provider-agnostic AI config resolver and the app `forge.config` settings contract (ADR-0011).

## Key surface

- `parseAiSettings(input)` — parses + validates the app's `forge.config.json` AI block (`z.object().strict()`; unknown provider fields are rejected).
- `resolveProvider(settings, lane?)` — resolves a named lane (default `settings.defaultLane`) to its provider/model binding; throws `NotFoundError` for a missing lane.
- Types: `AiSettings` (the full settings shape), `ProviderConfig` (one lane's binding).
- Supported providers: `openai`, `anthropic`, `google`, `openrouter`, `local`, `bedrock` (AWS), `azure-openai`, `ollama`, `groq`, `mistral`, `together`.
- API keys are resolved from environment variables by name (`apiKeyEnv`/`apiSecretEnv` fields) — never stored in the config file. A lane may instead set `keySource: "tenant"` for per-tenant encrypted BYOK, in which case no `apiKeyEnv` is named and the key is resolved from encrypted per-tenant storage at inference time.
- `bedrock` lanes carry a `region` + optional two-part credential (`apiKeyEnv`/`apiSecretEnv`, or the AWS default credential chain if both are omitted). `azure-openai` lanes address a deployment via `model` and require `apiVersion` + `baseUrl`.
- The Vercel AI SDK family (`ai`, `@ai-sdk/*`) is confined to `@caisson/ai-config` and `@caisson/ai-kit` — do not import SDK providers from other packages.

## Scope

AI provider config resolution and the app settings file only. Actual model calls belong in `@caisson/ai-kit`.
