// Agent-assisted setup coach (ADR-0076 seam + ADR-0011). Four tools that walk an ai-kit user from
// "no AI config" to a validated `forge.config` — registered through the EXISTING `registerTool`
// seam, visible to every authenticated caller once the host opts in.
//
// SECRETS-SAFE BY CONSTRUCTION:
//   - No tool ever receives or returns a secret VALUE. Args carry env-var NAMES, provider/model
//     identifiers, and booleans — never a key. `strictObject` rejects any unknown field, so a
//     `apiKey`-shaped arg is a ValidationError, not a silent leak.
//   - The environment is read through a presence-only port (`CoachEnvPort.has` → boolean): the
//     coach physically cannot read a value, only whether a NAME is set.
//   - The write surface emits env-var NAMES + a `.env.example` (`NAME=` with empty values) +
//     the provider/model config — never a secret. It is APPROVAL-GATED and fail-closed: with no
//     explicit `approve: true` the writer port is never invoked.
//   - AI-provider lanes only (the ai-config provider enum). DB/deploy coaching is the generator's
//     job, not this coach's.
//   - No shell, no subprocess: persistence is an injected port (test-doubled in CI).
//
// coach.ts imports NOTHING from server.ts — it declares the minimal slice of the seam it needs
// (`CoachToolRegistrar`). `McpServer` is structurally assignable to it, so `server.ts` wires the
// coach one-directionally (server → coach) with no import cycle.
import { z } from "zod";
import { ValidationError, parseStrict, strictObject } from "@caisson-sh/kernel";
import {
  parseAiSettings,
  type AiSettings,
  type ProviderConfig,
} from "@caisson-sh/ai-config";

/** Presence-only view of the environment: returns whether a NAME is set, never its value. */
export interface CoachEnvPort {
  has(name: string): boolean;
}

/** A single file the coach would persist — NAMES + config only, never a secret value. */
export interface ForgeConfigFile {
  readonly path: string;
  readonly contents: string;
}

/** Persistence seam for the approved write. Test-doubled in CI; an fs adapter in prod. */
export interface CoachWriterPort {
  write(files: readonly ForgeConfigFile[]): Promise<void>;
}

/**
 * The minimal slice of the ADR-0076 server seam the coach drives — just tool registration.
 * `McpServer` (from server.ts) is structurally assignable to this, so the coach never imports
 * the server (no dependency cycle). The handler ctx is intentionally narrowed to `{ args }`:
 * authentication is the seam's job, so a coach handler needs no session.
 */
export interface CoachToolRegistrar {
  registerTool(registration: {
    name: string;
    /** Declarative manifest fields (ADR-0216) — validated by the real seam at registration time. */
    description: string;
    version: string;
    audit: { logArgs: boolean };
    handler: (ctx: { args: unknown }) => Promise<unknown>;
  }): void;
  /** The prompt-registration half of the seam. `McpServer` is structurally assignable to this. A
   *  coach prompt handler needs no session (the seam authenticates) — just the validated args. */
  registerPrompt(registration: {
    name: string;
    description: string;
    version: string;
    arguments: readonly {
      name: string;
      description?: string;
      required: boolean;
    }[];
    handler: (ctx: { args: Readonly<Record<string, string>> }) => Promise<{
      description?: string;
      messages: readonly {
        role: "user" | "assistant";
        content: { type: "text"; text: string };
      }[];
    }>;
  }): void;
}

export interface CoachOptions {
  /** Presence-only env reader (secrets-safe). */
  readonly env: CoachEnvPort;
  /** Where the approved config is persisted. */
  readonly writer: CoachWriterPort;
  /** Output path for the buyer config. Default `"forge.config.json"`. */
  readonly configPath?: string;
  /** Output path for the key-name template. Default `".env.example"`. */
  readonly envExamplePath?: string;
}

/** Result of `write_forge_config`: fail-closed preview, or the persisted paths after approval. */
export type CoachWriteResult =
  | {
      readonly status: "pending_approval";
      readonly files: readonly ForgeConfigFile[];
    }
  | { readonly status: "written"; readonly written: readonly string[] };

/** Default env-var NAME per AI provider (BYOK, ADR-0011) — exhaustive over the provider enum. */
const DEFAULT_KEY_ENV: Record<ProviderConfig["provider"], string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  local: "LOCAL_AI_API_KEY",
  // ADR-0160 backends. Bedrock's access-key-id is the `apiKeyEnv` half of its two-part credential
  // (the secret half is `apiSecretEnv`); azure-openai + ollama name a single key.
  bedrock: "AWS_ACCESS_KEY_ID",
  "azure-openai": "AZURE_OPENAI_API_KEY",
  ollama: "OLLAMA_API_KEY",
  // Named OpenAI-compatible lanes added in the Kickoff-F wave.
  groq: "GROQ_API_KEY",
  mistral: "MISTRAL_API_KEY",
  together: "TOGETHER_API_KEY",
};

function defaultKeyEnv(provider: string): string {
  return (
    (DEFAULT_KEY_ENV as Record<string, string | undefined>)[provider] ??
    `${provider.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_API_KEY`
  );
}

/** Distinct, sorted env-var NAMES referenced by a settings object's lanes. A per-tenant BYOK lane
 *  (ADR-0162) names no env var (its key is stored encrypted per tenant), so it contributes none. */
function keyNames(settings: AiSettings): string[] {
  return [
    ...new Set(
      Object.values(settings.lanes)
        .map((lane) => lane.apiKeyEnv)
        .filter((name): name is string => name !== undefined),
    ),
  ].sort();
}

/** Build the would-be-written files (NAMES + config only) from validated settings. */
function buildFiles(
  settings: AiSettings,
  configPath: string,
  envExamplePath: string,
): ForgeConfigFile[] {
  const names = keyNames(settings);
  const envExample = [
    "# .env.example — generated by the @caisson-sh setup coach.",
    "# Provider API keys for your configured AI lanes. NEVER commit real values;",
    "# set them in a gitignored .env. The coach writes NAMES only.",
    ...names.map((name) => `${name}=`),
    "",
  ].join("\n");
  return [
    { path: configPath, contents: `${JSON.stringify(settings, null, 2)}\n` },
    { path: envExamplePath, contents: envExample },
  ];
}

const ENV_NAME = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "must be a valid env-var name");

const inspectArgs = strictObject({
  names: z.array(ENV_NAME).min(1).max(50),
});

const proposeArgs = strictObject({
  defaultLane: z.string().min(1).max(64),
  lanes: z
    .array(
      strictObject({
        name: z.string().min(1).max(64),
        provider: z.string().min(1).max(40),
        model: z.string().min(1).max(200),
        apiKeyEnv: ENV_NAME.optional(),
        baseUrl: z.string().url().optional(),
      }),
    )
    .min(1)
    .max(20),
});

// `settings` is opaque here and validated by `parseAiSettings` inside the handler (single source
// of truth for the lane/provider shape) — kept `unknown` so the strict provider enum lives in one
// place (ai-config), not duplicated at the boundary.
const writeArgs = strictObject({
  settings: z.unknown(),
  approve: z.boolean().default(false),
});

const validateArgs = strictObject({
  settings: z.unknown(),
});

/**
 * Register the four setup-coach tools on `server` through the ADR-0076 seam. Every authenticated
 * caller sees them once the host passes `coach` options; without them no coach tool exists.
 */
export function registerCoachTools(
  server: CoachToolRegistrar,
  options: CoachOptions,
): void {
  const configPath = options.configPath ?? "forge.config.json";
  const envExamplePath = options.envExamplePath ?? ".env.example";

  // inspect_env: report which provider-key NAMES are set — presence (boolean) ONLY, never values.
  server.registerTool({
    name: "inspect_env",
    description:
      "Report which provider-key env-var NAMES are set (presence only, never values).",
    version: "1.0.0",
    audit: { logArgs: false },
    handler: async ({ args }) => {
      const { names } = parseStrict(inspectArgs, args);
      const vars = names.map((name) => ({
        name,
        present: options.env.has(name),
      }));
      return { vars, allPresent: vars.every((v) => v.present) };
    },
  });

  // propose_ai_config: turn desired AI lanes into a validated forge.config + the key NAMES to set.
  server.registerTool({
    name: "propose_ai_config",
    description:
      "Turn desired AI lanes into a validated forge.config plus the required env-var key NAMES.",
    version: "1.0.0",
    audit: { logArgs: false },
    handler: async ({ args }) => {
      const input = parseStrict(proposeArgs, args);
      const lanes: Record<string, unknown> = {};
      for (const lane of input.lanes) {
        lanes[lane.name] = {
          provider: lane.provider,
          model: lane.model,
          apiKeyEnv: lane.apiKeyEnv ?? defaultKeyEnv(lane.provider),
          ...(lane.baseUrl !== undefined ? { baseUrl: lane.baseUrl } : {}),
        };
      }
      if (!(input.defaultLane in lanes)) {
        throw new ValidationError("defaultLane must name a proposed lane", {
          defaultLane: input.defaultLane,
        });
      }
      // Delegate provider-enum + strict validation to ai-config (single source of truth).
      const settings = parseAiSettings({
        defaultLane: input.defaultLane,
        lanes,
      });
      return { settings, requiredEnvVars: keyNames(settings) };
    },
  });

  // write_forge_config: APPROVAL-GATED, fail-closed. NAMES + config only — never a secret value.
  server.registerTool({
    name: "write_forge_config",
    description:
      "Persist an approved forge.config + .env.example (NAMES only). Fail-closed without approve:true.",
    version: "1.0.0",
    audit: { logArgs: false },
    handler: async ({ args }): Promise<CoachWriteResult> => {
      const input = parseStrict(writeArgs, args);
      const settings = parseAiSettings(input.settings);
      const files = buildFiles(settings, configPath, envExamplePath);
      if (!input.approve) {
        // Fail-closed: no approval → preview only, the writer port is never touched.
        return { status: "pending_approval", files };
      }
      await options.writer.write(files);
      return { status: "written", written: files.map((f) => f.path) };
    },
  });

  // validate_setup: config parses AND every referenced key NAME is present (fail-closed verdict).
  server.registerTool({
    name: "validate_setup",
    description:
      "Verify a forge.config parses and every referenced key NAME is present in the environment.",
    version: "1.0.0",
    audit: { logArgs: false },
    handler: async ({ args }) => {
      const { settings } = parseStrict(validateArgs, args);
      const parsed = parseAiSettings(settings);
      const checked = keyNames(parsed);
      const missing = checked.filter((name) => !options.env.has(name));
      return { valid: missing.length === 0, checked, missing };
    },
  });

  // setup_ai_config: the guided walkthrough that ties the four coach tools together. Args carry
  // provider IDENTIFIERS only — never a key — so the prompt stays secrets-safe by construction like
  // the tools it narrates.
  server.registerPrompt({
    name: "setup_ai_config",
    description:
      "Guided walkthrough: inspect env, propose a validated forge.config, verify keys, then write it.",
    version: "1.0.0",
    arguments: [
      {
        name: "providers",
        description: "Comma-separated provider ids, e.g. anthropic,openai.",
        required: true,
      },
      {
        name: "default_provider",
        description:
          "Which provider is the default lane (defaults to the first).",
        required: false,
      },
    ],
    handler: async ({ args }) => {
      // Parse the comma-list ourselves — a caller-visible ValidationError beats a malformed lane
      // surfacing three tool-calls later. Each segment must be a non-empty provider slug.
      // `providers` is a required arg → always present; the `?? ""` only satisfies
      // noUncheckedIndexedAccess and collapses cleanly to the empty→ValidationError path below.
      const providers = (args.providers ?? "")
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      const firstProvider = providers[0];
      if (firstProvider === undefined) {
        throw new ValidationError("providers must name at least one provider", {
          providers: args.providers ?? "",
        });
      }
      for (const p of providers) {
        if (!/^[a-z][a-z0-9-]*$/.test(p)) {
          throw new ValidationError("Malformed provider id", { provider: p });
        }
      }
      const defaultProvider = args.default_provider ?? firstProvider;
      if (!providers.includes(defaultProvider)) {
        throw new ValidationError("default_provider must be one of providers", {
          default_provider: defaultProvider,
        });
      }
      const envNames = [
        ...new Set(providers.map((p) => defaultKeyEnv(p))),
      ].sort();
      const lanes = providers.map((p) => ({
        name: p,
        provider: p,
        model: `<model-for-${p}>`,
        apiKeyEnv: defaultKeyEnv(p),
      }));
      const text = [
        `Set up AI config for providers: ${providers.join(", ")} (default lane: ${defaultProvider}).`,
        "",
        "1. Check which provider keys are already set (presence only) — call inspect_env:",
        JSON.stringify({ names: envNames }, null, 2),
        "",
        "2. Propose a validated forge.config — call propose_ai_config (replace each <model-for-*> placeholder with a real model id):",
        JSON.stringify({ defaultLane: defaultProvider, lanes }, null, 2),
        "",
        "3. Verify every referenced key NAME is present — call validate_setup with the settings propose_ai_config returned.",
        "",
        "4. Once valid and approved, persist it — call write_forge_config with those settings and approve:true. Without approve:true it only previews; a real key value is never written or logged.",
      ].join("\n");
      return {
        description: `AI setup walkthrough (${providers.join(", ")})`,
        messages: [{ role: "user", content: { type: "text", text } }],
      };
    },
  });
}

/**
 * Adapter producing a presence-only env port from a value-bearing source (default `process.env`).
 * Values are collapsed to booleans at this boundary — the coach module never sees a secret. An
 * empty string counts as unset (a `NAME=` placeholder is "not configured").
 */
export function presenceEnvPort(
  source: Record<string, string | undefined> = process.env,
): CoachEnvPort {
  return {
    has(name: string): boolean {
      const value = source[name];
      return value !== undefined && value !== "";
    },
  };
}
