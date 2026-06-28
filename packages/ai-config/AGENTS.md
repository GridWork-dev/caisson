# @caisson/ai-config — agent usage note

Provides the provider-agnostic AI config resolver and the buyer `forge.config` settings contract (ADR-0011).

## Key surface

- Resolves a named AI lane (`defaultLane` + `lanes` map) from the buyer's `forge.config.json`.
- Supported providers: `openai`, `anthropic`, `google`, `openrouter`, `local`.
- API keys are resolved from environment variables by name (`apiKeyEnv` field) — never stored in the config file.
- Validate configs with `z.object().strict()` at every ingestion boundary; unknown provider fields are rejected.
- The Vercel AI SDK family (`ai`, `@ai-sdk/*`) is confined to `@caisson/ai-config` and `@caisson/ai-kit` — do not import SDK providers from other packages (ADR-0011/0022).

## Scope

AI provider config resolution and the buyer settings file only. Actual model calls belong in `@caisson/ai-kit`.
