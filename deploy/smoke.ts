import {
  fetchWithTimeout,
  type FetchTimeoutOptions,
} from "../packages/kernel/src/fetch.ts";
import { ORIGIN_SECRET_HEADER } from "../packages/kernel/src/origin-gate.ts";
import { z } from "zod";
import { reportCliError } from "./manifest.ts";
import { validateStagingOrigins } from "./staging-origins.ts";

const REQUEST_TIMEOUT_MS = 10_000;
const CANARY_TAG = /^r[0-9]{1,20}$/;
const HEADER_VALUE = /^[^\r\n]+$/;
const ID_TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
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
    stagingOriginUrls: ServiceMapSchema.optional(),
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
  stagingOriginUrls?: Record<string, string> | undefined;
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

export type IdentityTokenProvider = (audience: string) => Promise<string>;

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

  if (canaryMode && parsed.stagingOriginUrls)
    throw new Error("STAGING_ORIGIN_URLS is only valid for staging smoke");
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

  if (parsed.mode === "staging") {
    if (!parsed.stagingOriginUrls)
      throw new Error("STAGING_ORIGIN_URLS is required for staging smoke");
    parsed.stagingOriginUrls = validateStagingOrigins(parsed.stagingOriginUrls);
  } else if (parsed.stagingOriginUrls) {
    throw new Error("STAGING_ORIGIN_URLS is only valid for staging smoke");
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

function canaryServiceAudience(
  config: ReturnType<typeof validateConfig>,
  target: Target,
): string {
  const url = new URL(config.canaryUrls![target.key]!);
  const prefix = `${config.canaryTag!}---`;
  if (!url.hostname.startsWith(prefix)) {
    throw new Error(`CANARY_URLS tag does not match ${target.key}`);
  }
  url.hostname = url.hostname.slice(prefix.length);
  return url.origin;
}

async function gcloudIdentityToken(audience: string): Promise<string> {
  const result = Bun.spawnSync([
    "gcloud",
    "auth",
    "print-identity-token",
    `--audiences=${audience}`,
  ]);
  if (result.exitCode !== 0) {
    throw new Error("gcloud failed to mint the demos canary identity token");
  }
  const token = new TextDecoder().decode(result.stdout).trim();
  if (token.length > 8_192 || !ID_TOKEN.test(token)) {
    throw new Error("gcloud returned an invalid demos canary identity token");
  }
  return token;
}

async function requestHeaders(
  config: ReturnType<typeof validateConfig>,
  target: Target,
  identityTokenProvider: IdentityTokenProvider,
): Promise<Headers> {
  const headers = new Headers({ accept: "application/json" });
  if (isCanaryMode(config.mode)) {
    if (target.originProtected) {
      headers.set(ORIGIN_SECRET_HEADER, config.originSecrets![target.key]!);
    }
    if (target.key === "caisson-demos") {
      const token = await identityTokenProvider(
        canaryServiceAudience(config, target),
      );
      if (token.length > 8_192 || !HEADER_VALUE.test(token)) {
        throw new Error("demos canary identity token is invalid");
      }
      headers.set("X-Serverless-Authorization", `Bearer ${token}`);
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
  identityTokenProvider: IdentityTokenProvider,
): Promise<void> {
  const response = await transport(
    `${requestOrigin(config, target)}${path}`,
    {
      method: "GET",
      redirect: "manual",
      headers: await requestHeaders(config, target, identityTokenProvider),
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
  identityTokenProvider: IdentityTokenProvider,
): Promise<void> {
  const headers = await requestHeaders(config, target, identityTokenProvider);
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

/** Negative legs use fresh headers: neither Access tokens, IAM tokens nor origin secrets. */
async function assertStagingDenials(
  config: ReturnType<typeof validateConfig>,
  target: Target,
  transport: TimedFetcher,
): Promise<void> {
  const publicDenied = await transport(
    `${target.origin}${target.healthPath}`,
    {
      method: "GET",
      redirect: "manual",
      headers: { accept: "text/html, application/json" },
    },
    { timeoutMs: REQUEST_TIMEOUT_MS },
  );
  let accessDenied = false;
  if ([302, 303, 307].includes(publicDenied.status)) {
    try {
      const login = new URL(publicDenied.headers.get("location") ?? "");
      accessDenied =
        login.protocol === "https:" &&
        login.username === "" &&
        login.password === "" &&
        login.port === "" &&
        /^[a-z0-9-]+\.cloudflareaccess\.com$/.test(login.hostname) &&
        login.pathname.startsWith("/cdn-cgi/access/login");
    } catch {
      /* Relative, malformed or unrelated redirects do not prove Access denial. */
    }
  } else if (publicDenied.status === 403) {
    accessDenied =
      publicDenied.headers.get("server") === "cloudflare" &&
      publicDenied.headers.has("cf-ray");
  }
  if (!accessDenied)
    throw new Error(
      `${target.key} Access denial boundary returned ${publicDenied.status}`,
    );

  const rawDenied = await transport(
    `${config.stagingOriginUrls![target.key]!}${target.canaryHealthPath}`,
    {
      method: "GET",
      redirect: "manual",
      headers: { accept: "application/json" },
    },
    { timeoutMs: REQUEST_TIMEOUT_MS },
  );
  if (rawDenied.status !== 401 && rawDenied.status !== 403) {
    throw new Error(
      `${target.key} raw origin/IAM denial boundary returned ${rawDenied.status}`,
    );
  }
}

export async function runSmoke(
  rawConfig: SmokeConfig,
  transport: TimedFetcher = fetchWithTimeout,
  identityTokenProvider: IdentityTokenProvider = gcloudIdentityToken,
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
  // credential. The IAM-only demos service additionally receives a Google ID token whose
  // audience is the untagged service URL. Post-deploy and rollback remain public Cloudflare checks.
  for (const target of targets) {
    await getTarget(
      config,
      target,
      canaryMode ? target.canaryHealthPath : target.healthPath,
      `${target.key} health`,
      transport,
      identityTokenProvider,
    );
    if (target.key === "caisson-site") {
      await getTarget(
        config,
        target,
        "/",
        "caisson-site page",
        transport,
        identityTokenProvider,
      );
    }
    if (config.mode === "staging")
      await assertStagingDenials(config, target, transport);
  }

  if (config.mode === "pre-migration") return;

  const license = targets.find((target) => target.key === "caisson-license");
  if (license) {
    await assertWriteBoundary(
      config,
      license,
      "/issue",
      {},
      transport,
      identityTokenProvider,
    );
  }
  const docs = targets.find((target) => target.key === "caisson-docs");
  if (docs) {
    await assertWriteBoundary(
      config,
      docs,
      "/query",
      { query: "deployment smoke", k: 1 },
      transport,
      identityTokenProvider,
    );
  }
}

function serviceMapFromEnvironment(
  name: "CANARY_URLS" | "ORIGIN_SECRETS" | "STAGING_ORIGIN_URLS",
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
    stagingOriginUrls: serviceMapFromEnvironment(
      "STAGING_ORIGIN_URLS",
      environmentVariables.STAGING_ORIGIN_URLS,
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
