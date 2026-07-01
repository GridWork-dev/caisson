// Provider-agnostic AI config resolver (ADR-0011). NO provider is hardcoded —
// the provider is always chosen from config, so swapping providers is a config
// change, not a code change. BYOK: each lane names the env var holding its key
// (`apiKeyEnv`); this package resolves which provider/model a lane maps to, and
// never reads the key itself. Pure logic, no network.
import { z } from "zod";
import { NotFoundError, parseStrict, strictObject } from "@caisson/kernel";

/**
 * One provider binding: provider/model for a lane + where its key lives. The provider set is a
 * config enum, never a code literal (ADR-0011) — new backends are additive here (ADR-0160):
 *   • `bedrock` (AWS) reads a region + a two-part credential: `apiKeyEnv` names the access-key-id env
 *     var and `apiSecretEnv` names the secret-access-key env var (omit both to let the AWS default
 *     credential chain resolve them);
 *   • `azure-openai` addresses a DEPLOYMENT via `model` and needs `apiVersion` + `baseUrl` (the Azure
 *     resource endpoint);
 *   • `ollama` is OpenAI-API-compatible — it rides the same transport as `local`, the buyer names its
 *     `baseUrl`.
 * As with every lane, this package only carries env-var NAMES, never a key value.
 */
const ProviderConfigSchema = strictObject({
  provider: z.enum([
    "openai",
    "anthropic",
    "google",
    "openrouter",
    "local",
    "bedrock",
    "azure-openai",
    "ollama",
  ]),
  model: z.string().min(1),
  apiKeyEnv: z.string().min(1),
  baseUrl: z.string().url().optional(),
  /** AWS region for `bedrock` (defaults to `AWS_REGION` when omitted). */
  region: z.string().min(1).optional(),
  /** API version for `azure-openai` (Azure OpenAI is versioned per call). */
  apiVersion: z.string().min(1).optional(),
  /** Env-var NAME holding the secret half of a two-part credential (`bedrock` secret-access-key). */
  apiSecretEnv: z.string().min(1).optional(),
});

/** Buyer `forge.config` surface: a default lane + capability→provider map. */
const AiSettingsSchema = strictObject({
  defaultLane: z.string().min(1),
  lanes: z.record(z.string(), ProviderConfigSchema),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type AiSettings = z.infer<typeof AiSettingsSchema>;

/** Parse + validate buyer settings; rejects unknown keys (ADR-0002). */
export function parseAiSettings(input: unknown): AiSettings {
  return parseStrict(AiSettingsSchema, input);
}

/**
 * Resolve the provider config for `lane` (default `settings.defaultLane`).
 * Reads config only — no provider literal appears in this path, so adding or
 * removing a provider stays a config change. Throws `NotFoundError` for a
 * missing lane.
 */
export function resolveProvider(
  settings: AiSettings,
  lane?: string,
): ProviderConfig {
  const name = lane ?? settings.defaultLane;
  const config = settings.lanes[name];
  if (config === undefined) {
    throw new NotFoundError(`AI lane not configured: ${name}`, { lane: name });
  }
  return config;
}
