// Provider-agnostic AI config resolver (ADR-0011). NO provider is hardcoded —
// the provider is always chosen from config, so swapping providers is a config
// change, not a code change. BYOK: each lane names the env var holding its key
// (`apiKeyEnv`); this package resolves which provider/model a lane maps to, and
// never reads the key itself. Pure logic, no network.
import { z } from "zod";
import { NotFoundError, parseStrict, strictObject } from "@caisson-sh/kernel";

/**
 * One provider binding: provider/model for a lane + where its key lives. The provider set is a
 * config enum, never a code literal (ADR-0011) — new backends are additive here (ADR-0160):
 *   • `bedrock` (AWS) reads a region + a two-part credential: `apiKeyEnv` names the access-key-id env
 *     var and `apiSecretEnv` names the secret-access-key env var (omit both to let the AWS default
 *     credential chain resolve them);
 *   • `azure-openai` addresses a DEPLOYMENT via `model` and needs `apiVersion` + `baseUrl` (the Azure
 *     resource endpoint);
 *   • `ollama` is OpenAI-API-compatible — it rides the same transport as `local`, the adopter names its
 *     `baseUrl`.
 *   • `groq` / `mistral` / `together` (ADR-0171 board lock 2026-07-06) are OpenAI-API-compatible
 *     hosted vendors, each with a hardcoded default `baseUrl` (overridable, like `openrouter`'s) —
 *     unlike `local`/`ollama` they need no caller-supplied host.
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
    "groq",
    "mistral",
    "together",
  ]),
  model: z.string().min(1),
  /**
   * Where the lane's key comes from (ADR-0162). Omitted/`env` is the operator-supplied env-pointer:
   * `apiKeyEnv` names the env var. `tenant` is per-tenant encrypted BYOK: the key is stored encrypted
   * per tenant (field-crypto) and resolved at inference time — the lane names NO `apiKeyEnv`. Left
   * OPTIONAL (not defaulted) so an existing env config round-trips byte-identically.
   */
  keySource: z.enum(["env", "tenant"]).optional(),
  /** Env-var NAME holding the key (required for an `env` lane; forbidden for a `tenant` lane). */
  apiKeyEnv: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  /** AWS region for `bedrock` (defaults to `AWS_REGION` when omitted). */
  region: z.string().min(1).optional(),
  /** API version for `azure-openai` (Azure OpenAI is versioned per call). */
  apiVersion: z.string().min(1).optional(),
  /** Env-var NAME holding the secret half of a two-part credential (`bedrock` secret-access-key). */
  apiSecretEnv: z.string().min(1).optional(),
}).superRefine((cfg, ctx) => {
  // The key-source discriminator: an env lane MUST name its env var; a per-tenant BYOK lane must NOT
  // (its key lives encrypted per tenant, not in env). Keeps ADR-0011's "carry the name, never the
  // value" contract intact for both modes.
  if (cfg.keySource === "tenant" && cfg.apiKeyEnv !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["apiKeyEnv"],
      message:
        "a per-tenant (BYOK) lane must not name apiKeyEnv — the key is stored encrypted per tenant",
    });
  }
  if (
    cfg.keySource !== "tenant" &&
    cfg.apiKeyEnv === undefined &&
    cfg.provider !== "bedrock"
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["apiKeyEnv"],
      message: "an env-pointer lane requires apiKeyEnv",
    });
  }
  // Azure OpenAI (ADR-0160 decision 3): `model` addresses a deployment, not a model name, so the
  // resource endpoint (`baseUrl`) and the per-call API version (`apiVersion`) are both required —
  // enforced here instead of failing downstream at SDK construction in ai-kit/providers.ts.
  if (cfg.provider === "azure-openai") {
    if (cfg.apiVersion === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["apiVersion"],
        message: "azure-openai requires apiVersion",
      });
    }
    if (cfg.baseUrl === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["baseUrl"],
        message: "azure-openai requires baseUrl",
      });
    }
  }
});

/** Adopter `forge.config` surface: a default lane + capability→provider map. */
const AiSettingsSchema = strictObject({
  defaultLane: z.string().min(1),
  lanes: z.record(z.string(), ProviderConfigSchema),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type AiSettings = z.infer<typeof AiSettingsSchema>;

/** Parse + validate adopter settings; rejects unknown keys (ADR-0002). */
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
