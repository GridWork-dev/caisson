import {
  fetchWithTimeout,
  type FetchTimeoutOptions,
} from "../packages/kernel/src/fetch.ts";
import { z } from "zod";
import {
  readManifest,
  reportCliError,
  requireService,
  type ServiceManifest,
} from "./manifest.ts";

export const OBSERVATION_SAMPLES = 20;
export const MAX_ERROR_RATE = 0.01;
export const MAX_P95_MS = 2_000;
const REQUEST_TIMEOUT_MS = 10_000;
const HEADER_VALUE = /^[^\r\n]+$/;
const PROJECT = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const REGION = /^[a-z]+-[a-z]+[0-9]$/;
const CANARY_TAG = /^r[0-9]{1,20}$/;
const ServiceKeySchema = z.enum([
  "caisson-site",
  "caisson-admin",
  "caisson-license",
  "caisson-docs",
  "caisson-demos",
]);

const ObservationConfigSchema = z
  .object({
    environment: z.enum(["staging", "production"]),
    step: z.enum(["5", "25", "100"]),
    project: z.string().trim().regex(PROJECT),
    region: z.string().trim().regex(REGION),
    canaryTag: z.string().trim().regex(CANARY_TAG),
    services: z
      .array(ServiceKeySchema)
      .min(1)
      .max(ServiceKeySchema.options.length)
      .refine((services) => new Set(services).size === services.length),
    accessClientId: z
      .string()
      .trim()
      .min(1)
      .max(2_048)
      .regex(HEADER_VALUE)
      .optional(),
    accessClientSecret: z
      .string()
      .trim()
      .min(1)
      .max(2_048)
      .regex(HEADER_VALUE)
      .optional(),
  })
  .strict()
  .superRefine((config, context) => {
    const hasId = config.accessClientId !== undefined;
    const hasSecret = config.accessClientSecret !== undefined;
    if (
      hasId !== hasSecret ||
      (config.environment === "staging" && !hasId) ||
      (config.services.includes("caisson-admin") && !hasId)
    ) {
      context.addIssue({
        code: "custom",
        message: "Cloudflare Access credentials must be a complete pair",
      });
    }
  });

export type ObservationConfig = {
  environment: string;
  step: string;
  project?: string | undefined;
  region?: string | undefined;
  canaryTag?: string | undefined;
  services?: string[] | undefined;
  accessClientId?: string | undefined;
  accessClientSecret?: string | undefined;
};
export type ObservationSample = { status: number; durationMs: number };
export type ObservationSummary = {
  samples: number;
  errors: number;
  errorRate: number;
  p95Ms: number;
};
type TimedFetcher = (
  input: string | URL | Request,
  init?: RequestInit,
  options?: FetchTimeoutOptions,
) => Promise<Response>;
type GcloudRunner = (arguments_: string[]) => string;

const TARGETS = {
  production: [
    {
      key: "caisson-site",
      origin: "https://caisson.sh",
      path: "/healthz",
      access: false,
    },
    {
      key: "caisson-admin",
      origin: "https://admin.caisson.sh",
      path: "/healthz",
      access: true,
    },
    {
      key: "caisson-license",
      origin: "https://license.caisson.sh",
      path: "/health",
      access: false,
    },
    {
      key: "caisson-docs",
      origin: "https://docs-api.caisson.sh",
      path: "/health",
      access: false,
    },
    // IAM-only demos is observed through the public site proxy, never a made-up host.
    {
      key: "caisson-demos",
      origin: "https://caisson.sh",
      path: "/demos/healthz",
      access: false,
    },
  ],
  staging: [
    {
      key: "caisson-site",
      origin: "https://caisson.gwstg.dev",
      path: "/healthz",
      access: true,
    },
    {
      key: "caisson-admin",
      origin: "https://caisson-admin.gwstg.dev",
      path: "/healthz",
      access: true,
    },
    {
      key: "caisson-license",
      origin: "https://caisson-license.gwstg.dev",
      path: "/health",
      access: true,
    },
    {
      key: "caisson-docs",
      origin: "https://caisson-docs.gwstg.dev",
      path: "/health",
      access: true,
    },
    {
      key: "caisson-demos",
      origin: "https://caisson.gwstg.dev",
      path: "/demos/healthz",
      access: true,
    },
  ],
} as const;

function parseConfig(
  raw: ObservationConfig,
): z.infer<typeof ObservationConfigSchema> {
  const result = ObservationConfigSchema.safeParse(raw);
  if (!result.success) {
    if (raw.environment !== "staging" && raw.environment !== "production") {
      throw new Error("ENVIRONMENT must be staging or production");
    }
    if (raw.step !== "5" && raw.step !== "25" && raw.step !== "100") {
      throw new Error("STEP must be 5, 25, or 100");
    }
    if (!raw.project || !PROJECT.test(raw.project)) {
      throw new Error("GCP_PROD_PROJECT is invalid");
    }
    if (!raw.region || !REGION.test(raw.region)) {
      throw new Error("GCP_REGION is invalid");
    }
    if (!raw.canaryTag || !CANARY_TAG.test(raw.canaryTag)) {
      throw new Error("CANARY_TAG is invalid");
    }
    const services = raw.services;
    if (
      !Array.isArray(services) ||
      services.length === 0 ||
      new Set(services).size !== services.length ||
      services.some((service) => !ServiceKeySchema.safeParse(service).success)
    ) {
      throw new Error("SERVICES are invalid");
    }
    if (
      (raw.environment === "staging" || services.includes("caisson-admin")) &&
      (!raw.accessClientId || !raw.accessClientSecret)
    ) {
      throw new Error("Cloudflare Access service credentials are required");
    }
    throw new Error("Cloudflare Access service credentials are invalid");
  }
  return result.data;
}

export function observationRequest(
  rawConfig: ObservationConfig,
  sample: number,
): { url: string; headers: Headers } {
  const config = parseConfig(rawConfig);
  if (!Number.isSafeInteger(sample) || sample < 0) {
    throw new Error("sample index is invalid");
  }
  const targets = config.services.map((service) => {
    const target = TARGETS[config.environment].find(
      (candidate) => candidate.key === service,
    );
    if (!target) throw new Error(`unknown observation target ${service}`);
    return target;
  });
  const target = targets[sample % targets.length]!;
  const headers = new Headers({ accept: "application/json" });
  if (target.access) {
    const accessClientId = config.accessClientId;
    const accessClientSecret = config.accessClientSecret;
    if (!accessClientId || !accessClientSecret) {
      throw new Error("Cloudflare Access service credentials are required");
    }
    headers.set("CF-Access-Client-Id", accessClientId);
    headers.set("CF-Access-Client-Secret", accessClientSecret);
  }
  return {
    url: `${target.origin}${target.path}?observe=${config.step}-${String(sample)}`,
    headers,
  };
}

function runGcloud(arguments_: string[]): string {
  const result = Bun.spawnSync(["gcloud", ...arguments_]);
  if (result.exitCode !== 0) {
    throw new Error("gcloud could not inspect rollout traffic");
  }
  return new TextDecoder().decode(result.stdout).trim();
}

export function verifyRolloutTraffic(
  serviceKeys: string[],
  rawConfig: ObservationConfig,
  gcloud: GcloudRunner = runGcloud,
): void {
  const config = parseConfig(rawConfig);
  if (
    serviceKeys.length === 0 ||
    new Set(serviceKeys).size !== serviceKeys.length ||
    serviceKeys.some((service) => !ServiceKeySchema.safeParse(service).success)
  ) {
    throw new Error("service keys are invalid");
  }

  for (const service of serviceKeys) {
    let actual: string;
    try {
      actual = gcloud([
        "run",
        "services",
        "describe",
        service,
        "--project",
        config.project,
        "--region",
        config.region,
        `--format=value(status.traffic.filter(tag=${config.canaryTag}).percent)`,
      ]).trim();
    } catch {
      throw new Error(`could not verify rollout traffic for ${service}`);
    }
    if (actual !== config.step) {
      throw new Error(
        `${service} tag ${config.canaryTag} has ${actual || "no"}% traffic; expected ${config.step}%`,
      );
    }
  }
}

export function selectedServicesFromCanaryUrls(
  manifest: ServiceManifest,
  raw: string | undefined,
): string[] {
  const source = raw?.trim();
  if (!source) throw new Error("CANARY_URLS is required");
  if (source.length > 32_768) throw new Error("CANARY_URLS is too large");

  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch {
    throw new Error("CANARY_URLS must be valid JSON");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("CANARY_URLS must be a JSON object");
  }
  const entries = Object.entries(value);
  if (entries.length === 0) {
    throw new Error("CANARY_URLS must contain at least one service");
  }
  for (const [service, rawUrl] of entries) {
    requireService(manifest, service);
    if (typeof rawUrl !== "string") {
      throw new Error(`CANARY_URLS.${service} is invalid`);
    }
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new Error(`CANARY_URLS.${service} is invalid`);
    }
    if (
      url.protocol !== "https:" ||
      !url.hostname.endsWith(".run.app") ||
      url.hostname === "run.app" ||
      url.username !== "" ||
      url.password !== "" ||
      url.port !== "" ||
      (url.pathname !== "" && url.pathname !== "/") ||
      url.search !== "" ||
      url.hash !== ""
    ) {
      throw new Error(`CANARY_URLS.${service} is invalid`);
    }
  }
  return entries.map(([service]) => service).sort();
}

export function evaluateObservation(
  window: ObservationSample[],
  maximumErrorRate: number,
  maximumP95Ms: number,
): ObservationSummary {
  if (window.length === 0) throw new Error("observation produced no samples");
  if (
    !Number.isFinite(maximumErrorRate) ||
    maximumErrorRate < 0 ||
    maximumErrorRate > 1
  ) {
    throw new Error("error threshold is invalid");
  }
  if (!Number.isFinite(maximumP95Ms) || maximumP95Ms < 0) {
    throw new Error("latency threshold is invalid");
  }
  if (
    window.some(
      ({ status, durationMs }) =>
        !Number.isSafeInteger(status) ||
        status < 0 ||
        !Number.isFinite(durationMs) ||
        durationMs < 0,
    )
  ) {
    throw new Error("observation sample is invalid");
  }

  const errors = window.filter(({ status }) => status !== 200).length;
  const errorRate = errors / window.length;
  const durations = window
    .map(({ durationMs }) => durationMs)
    .sort((left, right) => left - right);
  const p95Index = Math.max(0, Math.ceil(durations.length * 0.95) - 1);
  const p95Ms = Math.round(durations[p95Index]!);

  if (errorRate > maximumErrorRate) {
    throw new Error(
      `error rate ${errorRate.toFixed(4)} breached ${maximumErrorRate.toFixed(4)}`,
    );
  }
  if (p95Ms > maximumP95Ms) {
    throw new Error(
      `p95 ${String(p95Ms)}ms breached ${String(maximumP95Ms)}ms`,
    );
  }
  return { samples: window.length, errors, errorRate, p95Ms };
}

export async function runObservation(
  config: ObservationConfig,
  transport: TimedFetcher = fetchWithTimeout,
  sampleCount = OBSERVATION_SAMPLES,
  maximumErrorRate = MAX_ERROR_RATE,
  maximumP95Ms = MAX_P95_MS,
): Promise<ObservationSummary> {
  parseConfig(config);
  if (
    !Number.isSafeInteger(sampleCount) ||
    sampleCount < 1 ||
    sampleCount > 100
  ) {
    throw new Error("sample count must be between 1 and 100");
  }

  const requests = Array.from({ length: sampleCount }, async (_, index) => {
    const request = observationRequest(config, index);
    const started = performance.now();
    try {
      const response = await transport(
        request.url,
        {
          method: "GET",
          redirect: "manual",
          headers: request.headers,
        },
        { timeoutMs: REQUEST_TIMEOUT_MS },
      );
      return {
        status: response.status,
        durationMs: performance.now() - started,
      };
    } catch {
      return { status: 0, durationMs: performance.now() - started };
    }
  });
  return evaluateObservation(
    await Promise.all(requests),
    maximumErrorRate,
    maximumP95Ms,
  );
}

async function main(): Promise<void> {
  const environment = process.env.ENVIRONMENT?.trim();
  const step = process.env.STEP?.trim();
  const project = process.env.GCP_PROD_PROJECT?.trim();
  const region = process.env.GCP_REGION?.trim();
  const canaryTag = process.env.CANARY_TAG?.trim();
  if (!environment) throw new Error("ENVIRONMENT is required");
  if (!step) throw new Error("STEP is required");
  if (!project) throw new Error("GCP_PROD_PROJECT is required");
  if (!region) throw new Error("GCP_REGION is required");
  if (!canaryTag) throw new Error("CANARY_TAG is required");
  const manifest = await readManifest();
  const services = selectedServicesFromCanaryUrls(
    manifest,
    process.env.CANARY_URLS,
  );
  const config: ObservationConfig = {
    environment,
    step,
    project,
    region,
    canaryTag,
    services,
    accessClientId: process.env.CF_ACCESS_CLIENT_ID,
    accessClientSecret: process.env.CF_ACCESS_CLIENT_SECRET,
  };
  verifyRolloutTraffic(services, config);
  const summary = await runObservation(config);
  process.stdout.write(
    `observe step=${step} samples=${String(summary.samples)} errors=${String(summary.errors)} p95_ms=${String(summary.p95Ms)}\n`,
  );
}

if (import.meta.main) main().catch(reportCliError);
