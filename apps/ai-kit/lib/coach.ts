// Coach-configure a lane (ADR-0076 / P3-24). Drives the real setup-coach tools registered on the
// MCP seam through a minimal in-process registrar — propose → (approval-gated) write → validate —
// to produce the `AiSettings` the gateway prices + meters against. The coach is SECRETS-SAFE by
// construction: it reads env PRESENCE only (boolean), never a value, and the write surface emits
// env-var NAMES + a `.env.example`, never a key. Entitlement gating is the live MCP server's job;
// this registrar represents an already-entitled buyer, so it captures the handlers directly.
import { presenceEnvPort, registerCoachTools } from "@caisson/mcp-server";
import type {
  CoachToolRegistrar,
  CoachWriterPort,
  ForgeConfigFile,
} from "@caisson/mcp-server";
import { parseAiSettings } from "@caisson/ai-config";
import type { AiSettings } from "@caisson/ai-config";

type CoachHandler = (ctx: { args: unknown }) => Promise<unknown>;

export interface CoachConfigured {
  /** The validated lane settings the gateway resolves a provider/model from. */
  readonly settings: AiSettings;
  /** The provider-key env-var NAMES the buyer must set (never values). */
  readonly requiredEnvVars: readonly string[];
  /** Fail-closed verdict: every referenced key NAME is present. */
  readonly valid: boolean;
  /** Referenced key NAMES that are not yet set. */
  readonly missingEnvVars: readonly string[];
  /** The approval-gated files the coach would persist (NAMES + config only). */
  readonly files: readonly ForgeConfigFile[];
}

/** Read a property off an `unknown` coach result without widening to `any`. */
function pluck(obj: unknown, key: string): unknown {
  if (typeof obj === "object" && obj !== null && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

/**
 * Run the coach end-to-end for one provider lane. `envPresent` is a presence-only view of the
 * environment (the demo pretends the provider key NAME is set so the verdict is `valid`); a real
 * buyer passes `process.env` through `presenceEnvPort` — the coach still sees booleans only.
 */
export async function coachConfigureLane(
  provider = "openai",
  model = "model",
  envPresent: Record<string, string | undefined> = { OPENAI_API_KEY: "set" },
): Promise<CoachConfigured> {
  const handlers = new Map<string, CoachHandler>();
  const captured: ForgeConfigFile[] = [];
  const writer: CoachWriterPort = {
    async write(files) {
      captured.push(...files);
    },
  };
  const registrar: CoachToolRegistrar = {
    registerTool({ name, handler }) {
      handlers.set(name, handler);
    },
  };
  registerCoachTools(registrar, { env: presenceEnvPort(envPresent), writer });

  const run = async (name: string, args: unknown): Promise<unknown> => {
    const handler = handlers.get(name);
    if (handler === undefined) {
      throw new Error(`coach tool not registered: ${name}`);
    }
    return handler({ args });
  };

  const proposed = await run("propose_ai_config", {
    defaultLane: "default",
    lanes: [{ name: "default", provider, model }],
  });
  // Re-validate through ai-config (single source of truth for the lane/provider shape).
  const settings = parseAiSettings(pluck(proposed, "settings"));
  const requiredEnvVars = asStringArray(pluck(proposed, "requiredEnvVars"));

  // Approval-gated write: NAMES + config only, never a secret value.
  await run("write_forge_config", { settings, approve: true });

  const verdict = await run("validate_setup", { settings });

  return {
    settings,
    requiredEnvVars,
    valid: pluck(verdict, "valid") === true,
    missingEnvVars: asStringArray(pluck(verdict, "missing")),
    files: captured,
  };
}
