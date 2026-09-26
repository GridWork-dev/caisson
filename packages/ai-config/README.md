# @caisson-sh/ai-config

Provider-agnostic AI config resolver: parses an app's `forge.config` settings file and
resolves a named lane (OpenAI, Anthropic, Google, OpenRouter, local, AWS Bedrock, Azure
OpenAI, Ollama, Groq, Mistral, Together) to a provider/model binding. No provider is ever
hardcoded — swapping providers is a config change, not a code change — and this package
never reads API key values, only the env-var name a lane points to (or, for per-tenant
BYOK, defers to encrypted per-tenant storage).

- **Layer:** base

## Usage

```ts
import { parseAiSettings, resolveProvider } from "@caisson-sh/ai-config";

const settings = parseAiSettings(rawConfig); // rejects unknown keys
const lane = resolveProvider(settings); // resolves settings.defaultLane
```

## Groq / Mistral / Together lanes

Each rides an OpenAI-compatible transport with a hardcoded default `baseUrl` (override it
only to point at a gateway/proxy) — no caller-supplied host required, unlike `local`/`ollama`:

```json
{
  "defaultLane": "fast",
  "lanes": {
    "fast": {
      "provider": "groq",
      "model": "llama-3.3-70b-versatile",
      "apiKeyEnv": "GROQ_API_KEY"
    },
    "eu": {
      "provider": "mistral",
      "model": "mistral-large-latest",
      "apiKeyEnv": "MISTRAL_API_KEY"
    },
    "oss": {
      "provider": "together",
      "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      "apiKeyEnv": "TOGETHER_API_KEY"
    }
  }
}
```
