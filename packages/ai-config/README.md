# @caisson/ai-config

Provider-agnostic AI config resolver: parses a buyer's `forge.config` settings file and
resolves a named lane (OpenAI, Anthropic, Google, OpenRouter, local, AWS Bedrock, Azure
OpenAI, Ollama) to a provider/model binding. No provider is ever hardcoded — swapping
providers is a config change, not a code change — and this package never reads API key
values, only the env-var name a lane points to (or, for per-tenant BYOK, defers to
encrypted per-tenant storage).

- **Layer:** base

## Usage

```ts
import { parseAiSettings, resolveProvider } from "@caisson/ai-config";

const settings = parseAiSettings(rawConfig); // rejects unknown keys
const lane = resolveProvider(settings); // resolves settings.defaultLane
```
