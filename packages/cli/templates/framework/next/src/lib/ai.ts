// Provider-agnostic AI config via `@caisson-sh/ai-config`: the provider/model is always chosen from a
// lane map, never hardcoded — swapping providers is a config change, not a code change. This
// resolves WHICH provider/model backs a lane; the key VALUE is never read here — a caller reads
// `process.env[config.apiKeyEnv]` right before its own SDK call.
import { parseAiSettings, resolveProvider } from "@caisson-sh/ai-config";
import type { ProviderConfig } from "@caisson-sh/ai-config";

/** Your lane map — move this into your own config file/DB row as the app grows; the shape stays
 *  the same. Add a lane per use case (e.g. "summarize", "classify") rather than one global model. */
const settings = parseAiSettings({
  defaultLane: "default",
  lanes: {
    default: {
      provider: "openai",
      model: "gpt-4o-mini",
      apiKeyEnv: "OPENAI_API_KEY",
    },
  },
});

export function getAiProviderConfig(lane?: string): ProviderConfig {
  return resolveProvider(settings, lane);
}
