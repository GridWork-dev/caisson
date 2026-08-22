import { z } from "zod";

const SERVICE_KEY = /^[a-z][a-z0-9-]{0,62}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const HOSTNAME =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function repositoryPath(allowGlob: boolean) {
  return z
    .string()
    .trim()
    .min(1)
    .max(512)
    .refine(
      (value) =>
        !value.includes("\0") &&
        !value.startsWith("/") &&
        !value.split("/").includes(".."),
      { message: "must stay inside the repository" },
    )
    .refine(
      (value) =>
        allowGlob ||
        !["*", "?", "[", "]", "{", "}"].some((token) => value.includes(token)),
      { message: "must not be a glob" },
    );
}

const ServiceConfigSchema = z
  .object({
    dockerfile: repositoryPath(false),
    build_context: repositoryPath(false),
    watched_paths: z.array(repositoryPath(true)).min(1).max(128),
    healthcheck: z
      .string()
      .trim()
      .min(1)
      .max(256)
      .refine((value) => value.startsWith("/") && !value.startsWith("//"), {
        message: "must be an absolute URL path",
      }),
    // caisson-demos is IAM-only behind the site proxy and intentionally has no
    // hostname. Empty is valid; every hostname that is present remains strict.
    hostnames: z.array(z.string().trim().regex(HOSTNAME)).max(16),
    runtime: z.literal("cloud-run-service"),
  })
  .strict();

const JobConfigSchema = z
  .object({
    dockerfile: repositoryPath(false),
    build_context: repositoryPath(false),
    watched_paths: z.array(repositoryPath(true)).min(1).max(128),
    runtime: z.literal("cloud-run-job"),
  })
  .strict();

const ManifestSchema = z
  .object({
    _source: z.string().trim().min(1).max(512),
    repository: z.string().trim().regex(REPOSITORY),
    services: z
      .record(z.string().regex(SERVICE_KEY), ServiceConfigSchema)
      .refine((services) => Object.keys(services).length > 0, {
        message: "services must be non-empty",
      }),
    jobs: z.record(z.string().regex(SERVICE_KEY), JobConfigSchema),
  })
  .strict()
  .refine(
    ({ services, jobs }) =>
      !Object.keys(jobs).some((key) => Object.hasOwn(services, key)),
    { message: "service and job keys must not overlap" },
  );

export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;
export type JobConfig = z.infer<typeof JobConfigSchema>;
export type ServiceManifest = z.infer<typeof ManifestSchema>;

export function parseManifest(value: unknown): ServiceManifest {
  return ManifestSchema.parse(value);
}

export async function readManifest(): Promise<ServiceManifest> {
  let value: unknown;
  try {
    value = (await Bun.file(
      new URL("./services.json", import.meta.url),
    ).json()) as unknown;
  } catch {
    throw new Error("deploy/services.json is not valid JSON");
  }
  return parseManifest(value);
}

export function requireService(
  manifest: ServiceManifest,
  key: string,
): ServiceConfig {
  if (!Object.hasOwn(manifest.services, key)) {
    throw new Error(`unknown service ${key}`);
  }
  const service = manifest.services[key];
  if (!service) throw new Error(`unknown service ${key}`);
  return service;
}

export function requireBuildTarget(
  manifest: ServiceManifest,
  key: string,
): ServiceConfig | JobConfig {
  if (Object.hasOwn(manifest.services, key)) {
    return requireService(manifest, key);
  }
  if (!Object.hasOwn(manifest.jobs, key)) {
    throw new Error(`unknown service ${key}`);
  }
  const job = manifest.jobs[key];
  if (!job) throw new Error(`unknown service ${key}`);
  return job;
}

export function buildTargetKeys(manifest: ServiceManifest): string[] {
  return [
    ...Object.keys(manifest.services),
    ...Object.keys(manifest.jobs),
  ].sort();
}

export function output(name: string, value: string): void {
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(name)) {
    throw new Error("output name is invalid");
  }
  if (value.includes("\r") || value.includes("\n")) {
    throw new Error(`output ${name} must be one line`);
  }
  process.stdout.write(`${name}=${value}\n`);
}

export function reportCliError(error: unknown): void {
  const message = error instanceof Error ? error.message : "unknown failure";
  process.stderr.write(`error: ${message}\n`);
  process.exitCode = 1;
}
