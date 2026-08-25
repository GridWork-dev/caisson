import { describe, expect, test } from "bun:test";
import { manifestFixture } from "./test-fixture.ts";

const subject = await import("./observe.ts").catch(() => undefined);
const baseConfig = {
  environment: "production",
  step: "25",
  project: "example-prod-12345",
  region: "us-east4",
  canaryTag: "r42",
  services: [
    "caisson-site",
    "caisson-admin",
    "caisson-license",
    "caisson-docs",
    "caisson-demos",
  ],
};

function samples(count: number, durationMs: number, status = 200) {
  return Array.from({ length: count }, () => ({ status, durationMs }));
}

describe("observation gate", () => {
  test("accepts a healthy window and fails on error-rate or p95 breaches", () => {
    expect(subject?.evaluateObservation).toBeFunction();
    if (!subject) return;

    expect(subject.evaluateObservation(samples(20, 150), 0.01, 2_000)).toEqual({
      samples: 20,
      errors: 0,
      errorRate: 0,
      p95Ms: 150,
    });
    expect(() =>
      subject.evaluateObservation(
        [...samples(19, 100), ...samples(1, 100, 503)],
        0.01,
        2_000,
      ),
    ).toThrow("error rate 0.0500 breached 0.0100");
    expect(() =>
      subject.evaluateObservation(samples(20, 2_001), 0.01, 2_000),
    ).toThrow("p95 2001ms breached 2000ms");
  });

  test("rotates across public Cloudflare targets without a demos hostname", () => {
    expect(subject?.observationRequest).toBeFunction();
    if (!subject) return;

    const config = {
      ...baseConfig,
      accessClientId: "client-id",
      accessClientSecret: "client-secret",
    };
    const requests = Array.from({ length: 5 }, (_, index) =>
      subject.observationRequest(config, index),
    );
    expect(requests.map(({ url }) => url)).toEqual([
      "https://caisson.sh/healthz?observe=25-0",
      "https://admin.caisson.sh/healthz?observe=25-1",
      "https://license.caisson.sh/health?observe=25-2",
      "https://docs-api.caisson.sh/health?observe=25-3",
      "https://caisson.sh/demos/healthz?observe=25-4",
    ]);
    expect(requests.some(({ url }) => url.includes("run.app"))).toBe(false);
    expect(requests.some(({ url }) => url.includes("caisson-demos."))).toBe(
      false,
    );
    expect(requests[1]?.headers.get("cf-access-client-id")).toBe("client-id");
    expect(requests[0]?.headers.has("cf-access-client-id")).toBe(false);
  });

  test("scopes requests to selected services and never silently omits selected admin", () => {
    expect(subject?.observationRequest).toBeFunction();
    if (!subject) return;

    expect(() => subject.observationRequest(baseConfig, 0)).toThrow(
      "Cloudflare Access service credentials are required",
    );

    const selectedConfig = {
      ...baseConfig,
      services: ["caisson-site", "caisson-docs"],
    };
    const requests = Array.from({ length: 2 }, (_, index) =>
      subject.observationRequest(selectedConfig, index),
    );
    expect(requests.map(({ url }) => url)).toEqual([
      "https://caisson.sh/healthz?observe=25-0",
      "https://docs-api.caisson.sh/health?observe=25-1",
    ]);
  });

  test("derives the exact rollout set from the gcloud-resolved canary URL map", () => {
    expect(subject?.selectedServicesFromCanaryUrls).toBeFunction();
    if (!subject) return;

    expect(
      subject.selectedServicesFromCanaryUrls(
        manifestFixture,
        JSON.stringify({
          "caisson-docs": "https://tagged-docs.run.app",
          "caisson-site": "https://tagged-site.run.app",
        }),
      ),
    ).toEqual(["caisson-docs", "caisson-site"]);
    expect(() =>
      subject.selectedServicesFromCanaryUrls(
        manifestFixture,
        JSON.stringify({ "caisson-admin": "https://tagged-admin.run.app" }),
      ),
    ).toThrow("unknown service caisson-admin");
    expect(() =>
      subject.selectedServicesFromCanaryUrls(manifestFixture, "{}"),
    ).toThrow("CANARY_URLS must contain at least one service");
  });

  test("verifies the requested tag percentage on every owned service", () => {
    expect(subject?.verifyRolloutTraffic).toBeFunction();
    if (!subject) return;

    const calls: string[][] = [];
    const config = {
      ...baseConfig,
      accessClientId: "client-id",
      accessClientSecret: "client-secret",
    };
    subject.verifyRolloutTraffic(
      ["caisson-site", "caisson-admin"],
      config,
      (arguments_) => {
        calls.push(arguments_);
        return "25";
      },
    );
    expect(calls).toEqual([
      [
        "run",
        "services",
        "describe",
        "caisson-site",
        "--project",
        baseConfig.project,
        "--region",
        baseConfig.region,
        "--format=value(status.traffic.filter(tag=r42).percent)",
      ],
      [
        "run",
        "services",
        "describe",
        "caisson-admin",
        "--project",
        baseConfig.project,
        "--region",
        baseConfig.region,
        "--format=value(status.traffic.filter(tag=r42).percent)",
      ],
    ]);
    expect(() =>
      subject.verifyRolloutTraffic(["caisson-site"], config, () => "5"),
    ).toThrow("caisson-site tag r42 has 5% traffic; expected 25%");
  });

  test("samples the public paths and returns a gate summary", async () => {
    expect(subject?.runObservation).toBeFunction();
    if (!subject) return;

    const seen: string[] = [];
    const result = await subject.runObservation(
      {
        ...baseConfig,
        step: "5",
        accessClientId: "client-id",
        accessClientSecret: "client-secret",
      },
      async (input) => {
        seen.push(String(input));
        return new Response(null, { status: 200 });
      },
      5,
      0.01,
      2_000,
    );
    expect(result.samples).toBe(5);
    expect(result.errors).toBe(0);
    expect(seen).toHaveLength(5);
  });

  test("rejects CRLF in Access header values at the schema boundary", () => {
    expect(subject?.observationRequest).toBeFunction();
    if (!subject) return;

    expect(() =>
      subject.observationRequest(
        {
          ...baseConfig,
          step: "5",
          accessClientId: "client-id\r\ninjected: true",
          accessClientSecret: "client-secret",
        },
        0,
      ),
    ).toThrow("Cloudflare Access service credentials are invalid");
  });
});
