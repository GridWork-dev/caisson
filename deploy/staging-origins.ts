// R359 CR-04: resolve rather than synthesize raw staging URLs; no credential-bearing probe here.
import { z } from "zod";
import {
  createToolExec,
  type ExecFn,
} from "../packages/tool-exec/src/index.ts";
import { output, reportCliError } from "./manifest.ts";

export const STAGING_SERVICES = [
  "caisson-site",
  "caisson-admin",
  "caisson-license",
  "caisson-docs",
  "caisson-demos",
] as const;
const serviceSchema = z.enum(STAGING_SERVICES);
const projectSchema = z.string().regex(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/);
const regionSchema = z.string().regex(/^[a-z]+-[a-z]+[0-9]$/);
// Cloud Run supports both SERVICE-PROJECT.REGION.run.app and opaque hash-based hosts.
// Validate the entire canonical URL, not a substring or a URL-parser-normalized hostname.
const rawOrigin =
  /^https:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.){1,3}run\.app$/;
export function validateStagingOrigins(
  values: Record<string, string>,
): Record<string, string> {
  const keys = Object.keys(values);
  if (
    keys.length !== STAGING_SERVICES.length ||
    keys.some((key) => !serviceSchema.safeParse(key).success)
  )
    throw new Error("STAGING_ORIGIN_URLS must cover the staging fleet");
  const seen = new Set<string>();
  for (const service of STAGING_SERVICES) {
    const value = values[service];
    if (
      !value ||
      value.length > 253 ||
      !rawOrigin.test(value) ||
      value.includes("---") ||
      seen.has(value)
    )
      throw new Error(
        "STAGING_ORIGIN_URLS contains an invalid or duplicate raw service URL",
      );
    seen.add(value);
  }
  return { ...values };
}

export async function resolveStagingOrigins(
  project: string,
  region: string,
  execFn?: ExecFn,
): Promise<Record<string, string>> {
  projectSchema.parse(project);
  regionSchema.parse(region);
  const gate = createToolExec({
    allowlist: [
      {
        name: "describe-staging-service",
        command: "gcloud",
        argsSchema: z.tuple([
          z.literal("run"),
          z.literal("services"),
          z.literal("describe"),
          serviceSchema,
          z.literal("--project"),
          projectSchema,
          z.literal("--region"),
          regionSchema,
          z.literal("--format=json"),
        ]),
      },
    ],
    ...(execFn === undefined ? {} : { execFn }),
  });
  const urls: Record<string, string> = {};
  for (const service of STAGING_SERVICES) {
    const result = await gate.run(
      "describe-staging-service",
      [
        "run",
        "services",
        "describe",
        service,
        "--project",
        project,
        "--region",
        region,
        "--format=json",
      ],
      "Resolve staging denial-probe origin",
    );
    if (!result.ok)
      throw new Error(`Could not resolve staging origin for ${service}`);
    const description = z
      .object({
        metadata: z.object({ name: z.literal(service) }),
        status: z.object({ url: z.string().max(253) }),
      })
      .parse(JSON.parse(result.stdout) as unknown);
    urls[service] = description.status.url;
  }
  return validateStagingOrigins(urls);
}

async function main(): Promise<void> {
  const urls = await resolveStagingOrigins(
    process.env.GCP_NONPROD_PROJECT ?? "",
    process.env.GCP_REGION ?? "",
  );
  output("staging_origin_urls", JSON.stringify(urls));
}
if (import.meta.main) main().catch(reportCliError);
