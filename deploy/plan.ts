import { z } from "zod";
import {
  output,
  readManifest,
  reportCliError,
  requireBuildTarget,
  type ServiceManifest,
} from "./manifest.ts";

const DIGEST = /^sha256:[0-9a-f]{64}$/;
const ARTIFACT_REGISTRY =
  /^[a-z0-9][a-z0-9.-]*\.pkg\.dev\/[a-z][a-z0-9-]{4,28}[a-z0-9]\/[a-z][a-z0-9._-]{0,62}$/;
const DigestMapSchema = z.record(
  z.string().regex(/^[a-z][a-z0-9-]{0,62}$/),
  z.string().max(128),
);

export type DeploymentPlan = {
  services: Array<{ service: string; image: string }>;
  migrationJob: string;
  migrationImage: string;
};

export function parseDigests(value: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new Error("DIGESTS must be valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("DIGESTS must be a JSON object");
  }
  const result = DigestMapSchema.safeParse(parsed);
  if (!result.success)
    throw new Error("DIGESTS contains an invalid service or digest value");
  return Object.fromEntries(Object.entries(result.data));
}

export function createPlan(
  manifest: ServiceManifest,
  digests: Record<string, string>,
  environment: string,
  registry: string,
): DeploymentPlan {
  if (environment !== "staging" && environment !== "production") {
    throw new Error("ENVIRONMENT must be staging or production");
  }
  if (!ARTIFACT_REGISTRY.test(registry)) {
    throw new Error("GCP_REGISTRY must name an Artifact Registry repository");
  }

  const keys = Object.keys(digests).sort();
  if (keys.length === 0) {
    throw new Error("DIGESTS must contain at least one service");
  }
  const services: DeploymentPlan["services"] = [];
  let migrationJob = "";
  let migrationImage = "";
  for (const service of keys) {
    const target = requireBuildTarget(manifest, service);
    const digest = digests[service]!;
    if (!DIGEST.test(digest)) throw new Error(`invalid digest for ${service}`);
    const image = `${registry}/${service}@${digest}`;
    if (target.runtime === "cloud-run-service") {
      services.push({ service, image });
      continue;
    }
    if (service !== "caisson-migrate") {
      throw new Error(`unsupported deployment job ${service}`);
    }
    migrationJob = service;
    migrationImage = image;
  }

  return { services, migrationJob, migrationImage };
}

async function main(): Promise<void> {
  const digests = process.env.DIGESTS;
  const environment = process.env.ENVIRONMENT;
  const registry = process.env.GCP_REGISTRY;
  if (!digests) throw new Error("DIGESTS is required");
  if (!environment) throw new Error("ENVIRONMENT is required");
  if (!registry) throw new Error("GCP_REGISTRY is required");

  const plan = createPlan(
    await readManifest(),
    parseDigests(digests),
    environment,
    registry,
  );
  output("services", JSON.stringify(plan.services));
  output("migration_job", plan.migrationJob);
  output("migration_image", plan.migrationImage);
}

if (import.meta.main) main().catch(reportCliError);
