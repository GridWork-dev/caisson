// The provider profile + the env scrub — the pure half of @caisson-sh/agent-runner (ADR-0186 §4),
// carved out of agent-runner.ts so it can be imported without dragging the spawn/run-registry
// machinery (node:child_process, node:fs, node:path) behind it. Nothing here reaches a node
// builtin: it is zod, the kernel barrel, `URL`, and string work. `@caisson-sh/agent-runner/browser`
// is exactly this module (ADR-0396); the `.` barrel re-exports every name below unchanged.
import { z } from "zod";
import { ValidationError, strictObject } from "@caisson-sh/kernel";

// ---------------------------------------------------------------------------
// Provider config (ADR-0186 F2) — provider-agnostic { binary, baseUrlEnv, authEnv, model }.
// ---------------------------------------------------------------------------

/** Env-var NAME shape — `baseUrlEnv`/`authEnv` name variables, they never carry values. */
const envVarName = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]*$/, "must be an ENV_VAR-style name");

/**
 * A headless agent-CLI provider profile. `baseUrlEnv`/`authEnv` are the env-var NAMES the CLI
 * reads its endpoint + key from; the VALUES are supplied per spawn (the credential stays an
 * injected seam — this package never reads a dotenv/keychain itself). `args` is the argv template;
 * the literal tokens `{task}` and `{model}` are substituted WHOLE-TOKEN only, so a hostile task
 * string can never add, split, or merge argv entries (and there is no shell anywhere).
 */
export const ProviderConfig = strictObject({
  binary: z.string().trim().min(1).max(1024),
  baseUrlEnv: envVarName,
  authEnv: envVarName,
  model: z.string().trim().min(1).max(128),
  /** Env-var NAME for the CLI's isolated config dir (e.g. CLAUDE_CONFIG_DIR); omit if none. */
  configDirEnv: envVarName.optional(),
  /** Env-var NAME the CLI reads the model from; omit when the model travels via `args`. */
  modelEnv: envVarName.optional(),
  args: z.array(z.string().max(100_000)).max(64).default([]),
});
export type ProviderConfig = z.infer<typeof ProviderConfig>;
export type ProviderConfigInput = z.input<typeof ProviderConfig>;

/**
 * One worked provider profile (SPEC task 4): the Claude Code CLI in headless stream-json mode.
 * `--strict-mcp-config` with no `--mcp-config` means NO MCP servers — no credentialed side-effect
 * tool can be smuggled in via an operator-level config file (the isolated config dir closes the
 * user-level path too).
 */
export const CLAUDE_CLI_PROFILE: ProviderConfig = ProviderConfig.parse({
  binary: "claude",
  baseUrlEnv: "ANTHROPIC_BASE_URL",
  authEnv: "ANTHROPIC_AUTH_TOKEN",
  model: "sonnet",
  configDirEnv: "CLAUDE_CONFIG_DIR",
  modelEnv: "ANTHROPIC_MODEL",
  args: [
    "-p",
    "{task}",
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    "{model}",
    "--permission-mode",
    "acceptEdits",
    "--strict-mcp-config",
  ],
});

// ---------------------------------------------------------------------------
// Env scrub — the security core (ADR-0186 §4). Build the child env FROM SCRATCH.
// ---------------------------------------------------------------------------

/** The ONLY parent-env keys forwarded to the child. Deliberately excludes HOME, USER, and every
 *  credential — secrets are kept out of a process that egresses to a model provider. */
export const PASSTHROUGH_KEYS = [
  "PATH",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "TZ",
  "TMPDIR",
] as const;

export interface BuildEngineEnvOptions {
  provider: ProviderConfig;
  /** The ONE provider key placed into the child env (at `provider.authEnv`). Injected by the
   *  caller — this package never resolves credentials from disk or `process.env` itself. */
  authKey: string;
  /** Value for `provider.baseUrlEnv` — the provider's API endpoint. */
  baseUrl: string;
  /** Isolated HOME for the subprocess (no operator dotfile/keychain leakage). */
  home: string;
  /** Isolated CLI config dir (no operator-level MCP/tool credentials). */
  configDir: string;
}

/**
 * Build the SCRUBBED env for the agent subprocess. NEVER spreads `parentEnv`. Returns a fresh
 * object containing only the non-secret passthrough allowlist plus the provider routing vars.
 * This is the single place a secret could leak to the provider — the leak-guard test exercises it
 * with a polluted parentEnv AND end-to-end through a real spawn.
 *
 * `parentEnv` is typed structurally rather than as `NodeJS.ProcessEnv` so this module carries no
 * node ambient type: `process.env` still satisfies it, and a caller that already had a
 * `NodeJS.ProcessEnv`-typed reference is unaffected (the parameter only widened).
 */
export function buildEngineEnv(
  parentEnv: Readonly<Record<string, string | undefined>>,
  opts: BuildEngineEnvOptions,
): Record<string, string> {
  if (opts.authKey.trim().length === 0) {
    throw new ValidationError("buildEngineEnv: empty authKey");
  }
  let protocol: string;
  try {
    protocol = new URL(opts.baseUrl).protocol;
  } catch {
    throw new ValidationError("buildEngineEnv: baseUrl is not a URL");
  }
  // Both http and https are admitted, for ANY host — not just loopback. That is deliberate: the
  // canonical local-first endpoints are named services (`http://ollama:11434` under compose/K8s),
  // not literal loopback, so a loopback allowlist would reject the common case. It is also not a
  // trust boundary to defend: the same options object carries `provider.binary`, which reaches
  // `spawnChild` unchanged, so a caller who can set `baseUrl` already has arbitrary local
  // execution. Narrow the caller, not this check.
  if (protocol !== "https:" && protocol !== "http:") {
    throw new ValidationError("buildEngineEnv: baseUrl must be http(s)", {
      protocol,
    });
  }
  const env: Record<string, string> = {};
  for (const key of PASSTHROUGH_KEYS) {
    const value = parentEnv[key];
    if (typeof value === "string" && value.length > 0) env[key] = value;
  }
  // Isolation + provider routing only — no secret beyond the one provider key.
  env["HOME"] = opts.home;
  env[opts.provider.baseUrlEnv] = opts.baseUrl;
  env[opts.provider.authEnv] = opts.authKey;
  if (opts.provider.configDirEnv !== undefined) {
    env[opts.provider.configDirEnv] = opts.configDir;
  }
  if (opts.provider.modelEnv !== undefined) {
    env[opts.provider.modelEnv] = opts.provider.model;
  }
  // Hygiene for CLIs that honor these conventions: no self-update, no telemetry from the sandbox.
  env["DISABLE_AUTOUPDATER"] = "1";
  env["DISABLE_TELEMETRY"] = "1";
  env["DISABLE_ERROR_REPORTING"] = "1";
  return env;
}
