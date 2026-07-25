// Deterministic client-side mirror of @caisson/agent-runner's buildEngineEnv (ADR-0186 SS4) for the
// "agent-runner" poke (ADR-0378 lock 2). A faithful, standalone port of the package's pure env-scrub
// logic -- nothing here fetches, persists, measures, or uses Date.now/Math.random in a rendered-
// output path.
//
// Why mirrored instead of imported: the package's entry point (agent-runner.ts) imports
// node:child_process and node:fs at module scope for the spawn + run-registry machinery, so it
// cannot resolve in a browser bundle even though buildEngineEnv's own body never touches either.
// buildEngineEnv is plain string/URL logic with zero node-only calls, so the port below is
// line-for-line and needs no WebCrypto substitution. Parity is pinned in agent-runner-logic.test.ts
// against the real package (imported by relative path -- apps/site does not declare
// @caisson/agent-runner as a workspace dependency). No __golden__ fixture dir exists for this
// package, so parity runs directly against the real functions per the ADR-0378 binding rule.

/** Verbatim: agent-runner.ts's PASSTHROUGH_KEYS -- the ONLY parent-env keys ever forwarded. */
export const PASSTHROUGH_KEYS = [
  "PATH",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "TZ",
  "TMPDIR",
] as const;

/** The provider-routing subset of agent-runner.ts's ProviderConfig that buildEngineEnv reads. */
export interface ProviderRouting {
  readonly baseUrlEnv: string;
  readonly authEnv: string;
  readonly model: string;
  readonly configDirEnv?: string;
  readonly modelEnv?: string;
}

/** Verbatim field values: agent-runner.ts's CLAUDE_CLI_PROFILE, the one worked provider profile. */
export const CLAUDE_CLI_PROFILE: ProviderRouting = {
  baseUrlEnv: "ANTHROPIC_BASE_URL",
  authEnv: "ANTHROPIC_AUTH_TOKEN",
  model: "sonnet",
  configDirEnv: "CLAUDE_CONFIG_DIR",
  modelEnv: "ANTHROPIC_MODEL",
};

export interface BuildEngineEnvOptions {
  readonly provider: ProviderRouting;
  readonly authKey: string;
  readonly baseUrl: string;
  readonly home: string;
  readonly configDir: string;
}

/** Mirrors kernel's ValidationError shape (code "validation_error", HTTP 400) without importing it. */
export class EnvScrubError extends Error {
  readonly code = "validation_error";
  readonly httpStatus = 400;
  readonly details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "EnvScrubError";
    if (details !== undefined) this.details = details;
  }
}

/**
 * Verbatim algorithm: agent-runner.ts's buildEngineEnv. Builds the child env FROM SCRATCH -- it
 * never spreads `parentEnv`. Only PASSTHROUGH_KEYS members present (and non-empty) in `parentEnv`
 * survive; every other parent key, secret-shaped or not, is simply never read.
 */
export function buildEngineEnv(
  parentEnv: Readonly<Record<string, string | undefined>>,
  opts: BuildEngineEnvOptions,
): Record<string, string> {
  if (opts.authKey.trim().length === 0) {
    throw new EnvScrubError("buildEngineEnv: empty authKey");
  }
  let protocol: string;
  try {
    protocol = new URL(opts.baseUrl).protocol;
  } catch {
    throw new EnvScrubError("buildEngineEnv: baseUrl is not a URL");
  }
  // http is admitted for local-first providers (e.g. a loopback Ollama); everything else is https.
  if (protocol !== "https:" && protocol !== "http:") {
    throw new EnvScrubError("buildEngineEnv: baseUrl must be http(s)", {
      protocol,
    });
  }
  const env: Record<string, string> = {};
  for (const key of PASSTHROUGH_KEYS) {
    const value = parentEnv[key];
    if (typeof value === "string" && value.length > 0) env[key] = value;
  }
  // Isolation + provider routing only -- no secret beyond the one provider key.
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

/** The env keys buildEngineEnv adds beyond a surviving passthrough key, in the order it sets them. */
export function addedKeys(provider: ProviderRouting): string[] {
  const keys = ["HOME", provider.baseUrlEnv, provider.authEnv];
  if (provider.configDirEnv !== undefined) keys.push(provider.configDirEnv);
  if (provider.modelEnv !== undefined) keys.push(provider.modelEnv);
  keys.push(
    "DISABLE_AUTOUPDATER",
    "DISABLE_TELEMETRY",
    "DISABLE_ERROR_REPORTING",
  );
  return keys;
}
