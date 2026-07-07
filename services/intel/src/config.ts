// The single env boundary. Every knob and secret the daemon reads is picked from env into
// one record and validated with a strict Zod schema (strict guards MY typos — it never sees
// the rest of process.env). Absent optional legs self-skip downstream; a malformed required
// value fails startup closed rather than running with a silently-wrong config.
import { z } from "zod";
import { parseStrict, strictObject } from "@caisson/kernel";

type Env = Record<string, string | undefined>;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const TRUTHY = new Set(["1", "true", "yes"]);
const FALSY = new Set(["0", "false", "no"]);

/** A tri-state env flag collapsed to a bool: an explicit truthy/falsy spelling wins; anything
 *  else (including absent) falls back to `dflt`. Two independent flags in this config need
 *  opposite defaults (the scheduler defaults ON, the LLM seam defaults OFF), so the default is a
 *  parameter, not baked into one shared schema. */
const boolFlag = (dflt: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined) return dflt;
      const norm = v.trim().toLowerCase();
      if (TRUTHY.has(norm)) return true;
      if (FALSY.has(norm)) return false;
      return dflt;
    });

const positiveInt = (dflt: number) =>
  z.coerce.number().int().positive().default(dflt);

const nonEmpty = z.string().trim().min(1);

const ConfigSchema = strictObject({
  databaseUrl: nonEmpty,

  healthzPort: positiveInt(8791),
  healthzHost: z.string().trim().min(1).default("0.0.0.0"),
  schedulerEnabled: boolFlag(true),

  cadenceComplianceMs: positiveInt(DAY),
  cadenceSoc2Ms: positiveInt(30 * DAY),
  cadenceCompetitorMs: positiveInt(DAY),
  cadenceGithubMs: positiveInt(12 * HOUR),
  cadenceAnalyticsMs: positiveInt(DAY),
  cadenceErrorMs: positiveInt(15 * 60_000),

  competitorUrls: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    ),
  githubOrg: z.string().trim().min(1).default("caisson-sh"),
  githubToken: z.string().trim().optional(),

  posthogApiKey: z.string().trim().optional(),
  posthogApiHost: z.string().trim().url().default("https://us.posthog.com"),
  posthogProjectId: z.string().trim().default("493539"),

  plausibleApiKey: z.string().trim().optional(),
  plausibleApiHost: z.string().trim().url().default("https://plausible.io"),
  plausibleSiteId: z.string().trim().optional(),

  tgBridgeAlertUrl: z.string().trim().url().optional(),
  tgBridgeAlertToken: z.string().trim().optional(),
  linearApiKey: z.string().trim().optional(),
  linearTeamId: z.string().trim().optional(),

  alertRateMaxPerWindow: positiveInt(3),
  alertTz: z.string().trim().min(1).default("UTC"),
  alertQuietStart: z.coerce.number().int().min(0).max(23).default(0),
  alertQuietEnd: z.coerce.number().int().min(0).max(23).default(0),

  llmEnabled: boolFlag(false),
  openrouterApiKey: z.string().trim().optional(),
  llmModel: z.string().trim().min(1).default("anthropic/claude-3.5-haiku"),
});

export type Config = z.infer<typeof ConfigSchema>;

/** Assemble the intel-relevant subset of env, then strict-parse it into a typed Config. */
export function loadConfig(env: Env = process.env): Config {
  const raw = {
    databaseUrl: env.INTEL_DATABASE_URL,
    healthzPort: env.INTEL_HEALTHZ_PORT,
    healthzHost: env.INTEL_HEALTHZ_HOST,
    schedulerEnabled: env.INTEL_SCHEDULER_ENABLED,
    cadenceComplianceMs: env.INTEL_CADENCE_COMPLIANCE_MS,
    cadenceSoc2Ms: env.INTEL_CADENCE_SOC2_MS,
    cadenceCompetitorMs: env.INTEL_CADENCE_COMPETITOR_MS,
    cadenceGithubMs: env.INTEL_CADENCE_GITHUB_MS,
    cadenceAnalyticsMs: env.INTEL_CADENCE_ANALYTICS_MS,
    cadenceErrorMs: env.INTEL_CADENCE_ERROR_MS,
    competitorUrls: env.INTEL_COMPETITOR_URLS,
    githubOrg: env.INTEL_GITHUB_ORG,
    githubToken: env.GITHUB_TOKEN,
    posthogApiKey: env.POSTHOG_API_KEY,
    posthogApiHost: env.POSTHOG_API_HOST,
    posthogProjectId: env.POSTHOG_PROJECT_ID,
    plausibleApiKey: env.PLAUSIBLE_API_KEY,
    plausibleApiHost: env.PLAUSIBLE_API_HOST,
    plausibleSiteId: env.PLAUSIBLE_SITE_ID,
    tgBridgeAlertUrl: env.TG_BRIDGE_ALERT_URL,
    tgBridgeAlertToken: env.TG_BRIDGE_ALERT_TOKEN,
    linearApiKey: env.LINEAR_API_KEY,
    linearTeamId: env.LINEAR_TEAM_ID,
    alertRateMaxPerWindow: env.INTEL_ALERT_RATE_MAX_PER_WINDOW,
    alertTz: env.INTEL_ALERT_TZ,
    alertQuietStart: env.INTEL_ALERT_QUIET_START,
    alertQuietEnd: env.INTEL_ALERT_QUIET_END,
    llmEnabled: env.INTEL_LLM_ENABLED,
    openrouterApiKey: env.OPENROUTER_API_KEY,
    llmModel: env.INTEL_LLM_MODEL,
  };
  return parseStrict(ConfigSchema, raw);
}
