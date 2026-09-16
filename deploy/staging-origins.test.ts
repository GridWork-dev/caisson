import { expect, test } from "bun:test";
import {
  resolveStagingOrigins,
  STAGING_SERVICES,
  validateStagingOrigins,
} from "./staging-origins.ts";
import { readManifest } from "./manifest.ts";

const urls = Object.fromEntries(
  STAGING_SERVICES.map((service) => [
    service,
    `https://${service}-123456789.us-east1.run.app`,
  ]),
);
test("the governed gcloud argv gate resolves every staging service and validates names", async () => {
  const calls: { command: string; args: readonly string[] }[] = [];
  const result = await resolveStagingOrigins(
    "example-staging",
    "us-east1",
    async (command, args) => {
      calls.push({ command, args });
      return {
        exitCode: 0,
        stderr: "",
        stdout: JSON.stringify({
          metadata: { name: args[3] },
          status: { url: urls[args[3]!] },
        }),
      };
    },
  );
  expect(result).toEqual(urls);
  expect(calls).toEqual(
    STAGING_SERVICES.map((service) => ({
      command: "gcloud",
      args: [
        "run",
        "services",
        "describe",
        service,
        "--project",
        "example-staging",
        "--region",
        "us-east1",
        "--format=json",
      ],
    })),
  );
  expect(Object.keys((await readManifest()).services).sort()).toEqual(
    [...STAGING_SERVICES].sort(),
  );
});

test("invalid project/region never reaches the gcloud execution seam", async () => {
  let calls = 0;
  for (const [project, region] of [
    ["--project=other", "us-east1"],
    ["example-staging", "us-east1;evil"],
  ]) {
    await expect(
      resolveStagingOrigins(project!, region!, async () => {
        calls++;
        throw new Error("must not run");
      }),
    ).rejects.toThrow();
  }
  expect(calls).toBe(0);
});

test("gcloud failure and wrong resource metadata fail closed", async () => {
  await expect(
    resolveStagingOrigins("example-staging", "us-east1", async () => ({
      exitCode: 1,
      stderr: "private provider detail",
      stdout: "",
    })),
  ).rejects.toThrow("Could not resolve staging origin");
  await expect(
    resolveStagingOrigins("example-staging", "us-east1", async () => ({
      exitCode: 0,
      stderr: "",
      stdout: JSON.stringify({
        metadata: { name: "another-service" },
        status: { url: urls["caisson-site"] },
      }),
    })),
  ).rejects.toThrow();
});

test("raw URL map rejects missing, duplicate and unexpected services", () => {
  expect(() => validateStagingOrigins({})).toThrow();
  expect(() =>
    validateStagingOrigins({
      ...urls,
      unexpected: "https://unexpected.run.app",
    }),
  ).toThrow();
  expect(() =>
    validateStagingOrigins({ ...urls, "caisson-site": urls["caisson-admin"]! }),
  ).toThrow();
  expect(
    validateStagingOrigins(
      Object.fromEntries(
        STAGING_SERVICES.map((service) => [
          service,
          `https://${service}-opaque-ue.a.run.app`,
        ]),
      ),
    ),
  ).toBeDefined();
});

test("staging workflow resolves origins before smoke and passes the exact resolver output", async () => {
  const source = await Bun.file(
    new URL("../.github/workflows/deploy-staging.yml", import.meta.url),
  ).text();
  const workflow = Bun.YAML.parse(source) as {
    jobs: {
      deploy: {
        steps: { name?: string; run?: string; env?: Record<string, string> }[];
      };
    };
  };
  const steps = workflow.jobs.deploy.steps;
  const resolver = steps.findIndex(
    (step) =>
      step.name ===
      "resolve raw staging origins through the governed argv gate",
  );
  const smoke = steps.findIndex(
    (step) => step.name === "origin + Access bypass suite",
  );
  expect(resolver).toBeGreaterThan(-1);
  expect(smoke).toBeGreaterThan(resolver);
  expect(steps[resolver]!.run).toBe(
    'bun run deploy/staging-origins.ts >> "$GITHUB_OUTPUT"',
  );
  expect(steps[smoke]!.env?.STAGING_ORIGIN_URLS).toBe(
    "${{ steps.staging-origins.outputs.staging_origin_urls }}",
  );
  expect(steps[smoke]!.env?.MODE).toBe("staging");
});
