import {
  fetchWithTimeout,
  type FetchTimeoutOptions,
} from "../packages/kernel/src/fetch.ts";
import { ORIGIN_SECRET_HEADER } from "../packages/kernel/src/origin-gate.ts";
import { z } from "zod";
import { reportCliError } from "./manifest.ts";

const REQUEST_TIMEOUT_MS = 10_000;
const CANARY_TAG = /^r[0-9]{1,20}$/;
const HEADER_VALUE = /^[^\r\n]+$/;
const ENCODED_ORIGIN_SECRET = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const REQUIRED_HEADERS = [
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options",
] as const;

const ServiceKeySchema = z.enum([
  "caisson-site",
  "caisson-admin",
  "caisson-license",
  "caisson-docs",
  "caisson-demos",
]);
const ServiceMapSchema = z.record(
  z.string().min(1).max(128),
  z.string().min(1).max(2_048),
);
const SmokeConfigSchema = z
  .object({
    environment: z.enum(["staging", "production"]),
    mode: z.enum([
      "staging",
      "pre-migration",
      "post-migration",
      "post-deploy",
      "rollback",
    ]),
    canaryTag: z.string().trim().regex(CANARY_TAG).optional(),
    canaryUrls: ServiceMapSchema.optional(),
    originSecrets: ServiceMapSchema.optional(),
    service: ServiceKeySchema.optional(),
    accessClientId: z.string().min(1).max(2_048).regex(HEADER_VALUE).optional(),
    accessClientSecret: z
      .string()
      .min(1)
      .max(2_048)
      .regex(HEADER_VALUE)
      .optional(),
  })
  .strict();

export type SmokeConfig = {
  environment: string;
  mode: string;
  canaryTag?: string | undefined;
  canaryUrls?: Record<string, string> | undefined;
  originSecrets?: Record<string, string> | undefined;
  service?: string | undefined;
  accessClientId?: string | undefined;
  accessClientSecret?: string | undefined;
};

export type TimedFetcher = (
  input: string | URL | Request,
  init?: RequestInit,
  options?: FetchTimeoutOptions,
) => Promise<Response>;

type Environment = "staging" | "production";
type ServiceKey = z.infer<typeof ServiceKeySchema>;
type Target = {
  key: ServiceKey;
  origin: string;
  healthPath: string;
  canaryHealthPath: string;
  originProtected: boolean;
  accessProtected: boolean;
};

const TARGETS: Record<Environment, Target[]> = {
  production: [
    {
      key: "caisson-site",
      origin: "https://caisson.sh",
      healthPath: "/healthz",
      canaryHealthPath: "/healthz",
      originProtected: true,
      accessProtected: false,
    },
    {
      key: "caisson-admin",
      origin: "https://admin.caisson.sh",
      healthPath: "/healthz",
      canaryHealthPath: "/healthz",
      originProtected: true,
      accessProtected: true,
    },
    {
      key: "caisson-license",
      origin: "https://license.caisson.sh",
      healthPath: "/health",
      canaryHealthPath: "/health",
      originProtected: true,
      accessProtected: false,
    },
    {
      key: "caisson-docs",
      origin: "https://docs-api.caisson.sh",
      healthPath: "/health",
      canaryHealthPath: "/health",
      originProtected: true,
      accessProtected: false,
    },
    // caisson-demos deliberately has no hostname. The site proxy is its only
    // public contract and acquires the IAM identity before forwarding.
    {
      key: "caisson-demos",
      origin: "https://caisson.sh",
      healthPath: "/demos/healthz",
      canaryHealthPath: "/demos/healthz",
      originProtected: false,
      accessProtected: false,
    },
  ],
  staging: [
    {
      key: "caisson-site",
      origin: "https://caisson.gwstg.dev",
      healthPath: "/healthz",
      canaryHealthPath: "/healthz",
      originProtected: true,
      accessProtected: true,
    },
    {
      key: "caisson-admin",
      origin: "https://caisson-admin.gwstg.dev",
      healthPath: "/healthz",
      canaryHealthPath: "/healthz",
      originProtected: true,
      accessProtected: true,
    },
    {
      key: "caisson-license",
      origin: "https://caisson-license.gwstg.dev",
      healthPath: "/health",
      canaryHealthPath: "/health",
      originProtected: true,
      accessProtected: true,
    },
    {
      key: "caisson-docs",
      origin: "https://caisson-docs.gwstg.dev",
      healthPath: "/health",
      canaryHealthPath: "/health",
      originProtected: true,
      accessProtected: true,
    },
    {
      key: "caisson-demos",
      origin: "https://caisson.gwstg.dev",
      healthPath: "/demos/healthz",
      canaryHealthPath: "/demos/healthz",
      originProtected: false,
      accessProtected: true,
    },
  ],
};

function selectedTargets(
  environment: Environment,
  service: ServiceKey | undefined,
): Target[] {
  const targets = TARGETS[environment];
  if (!service) return targets;
  const selected = targets.find((target) => target.key === service);
  if (!selected) throw new Error(`unknown service ${service}`);
  return [selected];
}

function isCanaryMode(mode: string): boolean {
  return mode === "pre-migration" || mode === "post-migration";
}

function normalizeCanaryUrls(
  values: Record<string, string>,
): Record<string, string> {
  const entries = Object.entries(values);
  if (
    entries.length === 0 ||
    entries.length > ServiceKeySchema.options.length
  ) {
    throw new Error("CANARY_URLS is invalid");
  }

  const origins = new Set<string>();
  const normalized: Array<[string, string]> = [];
  for (const [service, value] of entries) {
    if (!ServiceKeySchema.safeParse(service).success) {
      throw new Error("CANARY_URLS is invalid");
    }
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error("CANARY_URLS is invalid");
    }
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      url.port !== "" ||
      url.pathname !== "/" ||
      url.search !== "" ||
      url.hash !== "" ||
      !url.hostname.endsWith(".run.app") ||
      url.hostname === "run.app" ||
      origins.has(url.origin)
    ) {
      throw new Error("CANARY_URLS is invalid");
    }
    origins.add(url.origin);
    normalized.push([service, url.origin]);
  }
  return Object.fromEntries(normalized);
}

function validateOriginSecrets(
  values: Record<string, string>,
): Record<string, string> {
  const entries = Object.entries(values);
  if (entries.length > ServiceKeySchema.options.length) {
    throw new Error("ORIGIN_SECRETS is invalid");
  }
  for (const [service, value] of entries) {
    if (
      !ServiceKeySchema.safeParse(service).success ||
      !ENCODED_ORIGIN_SECRET.test(value)
    ) {
      throw new Error("ORIGIN_SECRETS is invalid");
    }
  }
  return Object.fromEntries(entries);
}

function validateConfig(
  config: SmokeConfig,
): z.infer<typeof SmokeConfigSchema> {
  const result = SmokeConfigSchema.safeParse(config);
  if (!result.success) {
    if (
      config.environment !== "staging" &&
      config.environment !== "production"
    ) {
      throw new Error("ENVIRONMENT must be staging or production");
    }
    if (
      config.mode !== "staging" &&
      config.mode !== "pre-migration" &&
      config.mode !== "post-migration" &&
      config.mode !== "post-deploy" &&
      config.mode !== "rollback"
    ) {
      throw new Error("MODE is invalid");
    }
    if (config.canaryTag !== undefined && !CANARY_TAG.test(config.canaryTag)) {
      throw new Error("CANARY_TAG is invalid");
    }
    throw new Error("smoke configuration is invalid");
  }

  const parsed = result.data;
  const canaryMode = isCanaryMode(parsed.mode);
  if (parsed.mode === "staging" && parsed.environment !== "staging") {
    throw new Error("staging smoke requires staging");
  }
  if (canaryMode && !parsed.canaryTag)
    throw new Error("CANARY_TAG is required");
  if (canaryMode && parsed.environment !== "production") {
    throw new Error("canary smoke requires production");
  }
  if (canaryMode && !parsed.canaryUrls) {
    throw new Error("CANARY_URLS is required for canary smoke");
  }
  if (canaryMode && !parsed.originSecrets) {
    throw new Error("ORIGIN_SECRETS is required for canary smoke");
  }
  if (!canaryMode && (parsed.canaryUrls || parsed.originSecrets)) {
    throw new Error(`canary inputs are forbidden for ${parsed.mode} smoke`);
  }
  if (parsed.mode === "rollback" && !parsed.service) {
    throw new Error("SERVICE is required for rollback smoke");
  }

  if (canaryMode) {
    const canaryUrls = normalizeCanaryUrls(parsed.canaryUrls!);
    const originSecrets = validateOriginSecrets(parsed.originSecrets!);
    const targets = TARGETS.production.filter((target) =>
      Object.hasOwn(canaryUrls, target.key),
    );
    for (const target of targets) {
      if (target.originProtected && !Object.hasOwn(originSecrets, target.key)) {
        throw new Error(`ORIGIN_SECRETS is missing ${target.key}`);
      }
    }
    return { ...parsed, canaryUrls, originSecrets };
  }

  const targets = selectedTargets(parsed.environment, parsed.service);
  if (
    targets.some((target) => target.accessProtected) &&
    (!parsed.accessClientId || !parsed.accessClientSecret)
  ) {
    throw new Error("Cloudflare Access service credentials are required");
  }
  return parsed;
}

function requestHeaders(
  config: ReturnType<typeof validateConfig>,
  target: Target,
): Headers {
  const headers = new Headers({ accept: "application/json" });
  if (isCanaryMode(config.mode)) {
    if (target.originProtected) {
      headers.set(ORIGIN_SECRET_HEADER, config.originSecrets![target.key]!);
    }
  } else if (target.accessProtected) {
    headers.set("CF-Access-Client-Id", config.accessClientId!);
    headers.set("CF-Access-Client-Secret", config.accessClientSecret!);
  }
  return headers;
}

function requestOrigin(
  config: ReturnType<typeof validateConfig>,
  target: Target,
): string {
  return isCanaryMode(config.mode)
    ? config.canaryUrls![target.key]!
    : target.origin;
}

function assertSecurityHeaders(response: Response, label: string): void {
  for (const header of REQUIRED_HEADERS) {
    if (!response.headers.has(header)) {
      throw new Error(`${label} is missing ${header}`);
    }
  }
  if (response.headers.has("x-powered-by")) {
    throw new Error(`${label} exposes x-powered-by`);
  }
}

async function getTarget(
  config: ReturnType<typeof validateConfig>,
  target: Target,
  path: string,
  label: string,
  transport: TimedFetcher,
): Promise<void> {
  const response = await transport(
    `${requestOrigin(config, target)}${path}`,
    {
      method: "GET",
      redirect: "manual",
      headers: requestHeaders(config, target),
    },
    { timeoutMs: REQUEST_TIMEOUT_MS },
  );
  if (response.status !== 200) {
    throw new Error(`${label} returned ${response.status}`);
  }
  assertSecurityHeaders(response, label);
}

async function assertWriteBoundary(
  config: ReturnType<typeof validateConfig>,
  target: Target,
  path: string,
  body: object,
  transport: TimedFetcher,
): Promise<void> {
  const headers = requestHeaders(config, target);
  headers.set("content-type", "application/json");
  const response = await transport(
    `${requestOrigin(config, target)}${path}`,
    {
      method: "POST",
      redirect: "manual",
      headers,
      body: JSON.stringify(body),
    },
    { timeoutMs: REQUEST_TIMEOUT_MS },
  );
  if (response.status !== 401) {
    throw new Error(
      `${target.key} write auth boundary returned ${response.status}`,
    );
  }
  assertSecurityHeaders(response, `${target.key} write auth boundary`);
}

export async function runSmoke(
  rawConfig: SmokeConfig,
  transport: TimedFetcher = fetchWithTimeout,
): Promise<void> {
  const config = validateConfig(rawConfig);
  const canaryMode = isCanaryMode(config.mode);
  const targets = canaryMode
    ? TARGETS.production.filter((target) =>
        Object.hasOwn(config.canaryUrls!, target.key),
      )
    : selectedTargets(config.environment, config.service);

  // The workflow resolves tag URLs with gcloud; this code never synthesizes one.
  // Pre/post-migration calls the zero-traffic revision directly with its origin
  // credential. Post-deploy and rollback remain public Cloudflare checks.
  for (const target of targets) {
    await getTarget(
      config,
      target,
      canaryMode ? target.canaryHealthPath : target.healthPath,
      `${target.key} health`,
      transport,
    );
    if (target.key === "caisson-site") {
      await getTarget(config, target, "/", "caisson-site page", transport);
    }
  }

  if (config.mode === "pre-migration") return;

  const license = targets.find((target) => target.key === "caisson-license");
  if (license) {
    await assertWriteBoundary(config, license, "/issue", {}, transport);
  }
  const docs = targets.find((target) => target.key === "caisson-docs");
  if (docs) {
    await assertWriteBoundary(
      config,
      docs,
      "/query",
      { query: "deployment smoke", k: 1 },
      transport,
    );
  }
}

function serviceMapFromEnvironment(
  name: "CANARY_URLS" | "ORIGIN_SECRETS",
  value: string | undefined,
): Record<string, string> | undefined {
  const source = value?.trim();
  if (!source) return undefined;
  if (source.length > 32_768) throw new Error(`${name} is too large`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    throw new Error(`${name} must be valid JSON`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${name} must be a JSON object`);
  }
  const result = ServiceMapSchema.safeParse(parsed);
  if (!result.success) throw new Error(`${name} must map services to strings`);
  return Object.fromEntries(Object.entries(result.data));
}

export function smokeConfigFromEnvironment(
  environmentVariables: Record<string, string | undefined>,
): SmokeConfig {
  const environment = environmentVariables.ENVIRONMENT?.trim();
  if (!environment) throw new Error("ENVIRONMENT is required");
  const mode = environmentVariables.MODE?.trim();
  if (!mode) throw new Error("MODE is required");

  return {
    environment,
    mode,
    canaryTag: environmentVariables.CANARY_TAG?.trim(),
    canaryUrls: serviceMapFromEnvironment(
      "CANARY_URLS",
      environmentVariables.CANARY_URLS,
    ),
    originSecrets: serviceMapFromEnvironment(
      "ORIGIN_SECRETS",
      environmentVariables.ORIGIN_SECRETS,
    ),
    service: environmentVariables.SERVICE?.trim(),
    accessClientId: environmentVariables.CF_ACCESS_CLIENT_ID,
    accessClientSecret: environmentVariables.CF_ACCESS_CLIENT_SECRET,
  };
}

async function main(): Promise<void> {
  const config = smokeConfigFromEnvironment(process.env);
  await runSmoke(config);
  process.stdout.write(
    `smoke environment=${config.environment} mode=${config.mode} passed\n`,
  );
}

if (import.meta.main) main().catch(reportCliError);
