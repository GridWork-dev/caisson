// ADR-0316 W-FLEET — fleet-reads env gate + vendor-response parsers. Pure/dormant coverage: no live
// socket. The parsers are the load-bearing logic (node-id matching, status/metric extraction,
// degrade-to-empty); the dormant gate is the safety guarantee the /architecture overlay leans on.
import { afterEach, beforeEach, expect, mock, test } from "bun:test";

import {
  fetchFleetSnapshot,
  fleetConfigured,
  parseRailwayDeployments,
  parseWorkerMetrics,
} from "./fleet-reads.ts";

const ENV_KEYS = [
  "RAILWAY_API_TOKEN",
  "RAILWAY_PROJECT_TOKEN",
  "RAILWAY_PROJECT_ID",
  "CLOUDFLARE_ANALYTICS_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_WORKER_SCRIPT_NAME",
] as const;
let savedEnv: Record<string, string | undefined>;
let savedFetch: typeof globalThis.fetch;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  savedFetch = globalThis.fetch;
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  globalThis.fetch = savedFetch;
});

function clearEnv(): void {
  for (const k of ENV_KEYS) delete process.env[k];
}

test("dormant without env: unconfigured empty snapshot and no network call", async () => {
  clearEnv();
  const fetchSpy = mock(() => {
    throw new Error("network must not be called when dormant");
  });
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

  expect(fleetConfigured()).toBe(false);
  const snap = await fetchFleetSnapshot();
  expect(snap).toEqual({ configured: false, nodes: {} });
  expect(fetchSpy).not.toHaveBeenCalled();
});

test("fleetConfigured is true when EITHER upstream is set", () => {
  clearEnv();
  expect(fleetConfigured()).toBe(false);
  process.env.RAILWAY_API_TOKEN = "rw_test";
  expect(fleetConfigured()).toBe(true);
  delete process.env.RAILWAY_API_TOKEN;
  process.env.CLOUDFLARE_ANALYTICS_TOKEN = "cf_test";
  expect(fleetConfigured()).toBe(false); // account id still missing
  process.env.CLOUDFLARE_ACCOUNT_ID = "acct_test";
  expect(fleetConfigured()).toBe(true);
});

test("fleetConfigured is true for the project token+id pair alone, and false with only one half", () => {
  clearEnv();
  process.env.RAILWAY_PROJECT_TOKEN = "proj_test";
  expect(fleetConfigured()).toBe(false); // project id still missing
  process.env.RAILWAY_PROJECT_ID = "proj-id-123";
  expect(fleetConfigured()).toBe(true);
});

test("parseRailwayDeployments maps service names to topology node ids by substring", () => {
  const sample = {
    data: {
      me: {
        projects: {
          edges: [
            {
              node: {
                services: {
                  edges: [
                    {
                      node: {
                        name: "caisson-site",
                        serviceInstances: {
                          edges: [
                            {
                              node: { latestDeployment: { status: "SUCCESS" } },
                            },
                          ],
                        },
                      },
                    },
                    {
                      node: {
                        name: "caisson-support-bot",
                        serviceInstances: {
                          edges: [
                            {
                              node: { latestDeployment: { status: "CRASHED" } },
                            },
                          ],
                        },
                      },
                    },
                    {
                      // A service that maps to no topology node — ignored, not a throw.
                      node: {
                        name: "some-unrelated-db",
                        serviceInstances: { edges: [] },
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    },
  };
  expect(parseRailwayDeployments(sample)).toEqual({
    site: "SUCCESS",
    "support-bot": "CRASHED",
  });
});

test("parseRailwayDeployments maps a project-rooted response (Project-Access-Token shape)", () => {
  const sample = {
    data: {
      project: {
        services: {
          edges: [
            {
              node: {
                name: "caisson-docs",
                serviceInstances: {
                  edges: [
                    { node: { latestDeployment: { status: "SUCCESS" } } },
                  ],
                },
              },
            },
            {
              // Unrelated service — ignored, not a throw.
              node: {
                name: "some-unrelated-db",
                serviceInstances: { edges: [] },
              },
            },
          ],
        },
      },
    },
  };
  expect(parseRailwayDeployments(sample)).toEqual({ docs: "SUCCESS" });
});

test("parseRailwayDeployments degrades to {} on garbage, including malformed/unauthorized shapes", () => {
  expect(parseRailwayDeployments(null)).toEqual({});
  expect(parseRailwayDeployments({ nope: true })).toEqual({});
  expect(parseRailwayDeployments({ data: { me: null } })).toEqual({});
  // Project-token "Not Authorized" style error response — no `data.project`, no throw.
  expect(
    parseRailwayDeployments({
      errors: [{ message: "Not Authorized" }],
      data: { project: null },
    }),
  ).toEqual({});
  expect(
    parseRailwayDeployments({ data: { project: { services: null } } }),
  ).toEqual({});
});

test("parseWorkerMetrics sums requests + errors across rows", () => {
  const sample = {
    data: {
      viewer: {
        accounts: [
          {
            workersInvocationsAdaptive: [
              { sum: { requests: 100, errors: 3 } },
              { sum: { requests: 50, errors: 1 } },
            ],
          },
        ],
      },
    },
  };
  expect(parseWorkerMetrics(sample)).toEqual({ requests: 150, errors: 4 });
});

test("parseWorkerMetrics returns null when there is no data", () => {
  expect(parseWorkerMetrics(null)).toBeNull();
  expect(parseWorkerMetrics({ data: { viewer: { accounts: [] } } })).toBeNull();
  expect(
    parseWorkerMetrics({
      data: { viewer: { accounts: [{ workersInvocationsAdaptive: [] }] } },
    }),
  ).toBeNull();
});

// NOTE: this is the only test in the file that drives a live (non-dormant) Railway fetch through
// fetchFleetSnapshot — the module-scope 60s cache means a second such test could read this one's
// cached value instead of exercising its own mock. Keep it singular; cover other Railway response
// shapes via the pure parseRailwayDeployments tests above instead.
test("fetchFleetSnapshot prefers the project credential pair over the account token when both are set", async () => {
  clearEnv();
  process.env.RAILWAY_PROJECT_TOKEN = "proj_test";
  process.env.RAILWAY_PROJECT_ID = "proj-id-123";
  process.env.RAILWAY_API_TOKEN = "acct_test";

  let capturedHeaders: Record<string, string> | undefined;
  let capturedBody: string | undefined;
  const fetchSpy = mock((_url: string, init: RequestInit) => {
    capturedHeaders = init.headers as Record<string, string>;
    capturedBody = init.body as string;
    return Promise.resolve(
      new Response(
        JSON.stringify({
          data: {
            project: {
              services: {
                edges: [
                  {
                    node: {
                      name: "caisson-license",
                      serviceInstances: {
                        edges: [
                          {
                            node: { latestDeployment: { status: "SUCCESS" } },
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        }),
        { status: 200 },
      ),
    );
  });
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

  const snap = await fetchFleetSnapshot();

  expect(fetchSpy).toHaveBeenCalledTimes(1);
  expect(capturedHeaders?.["Project-Access-Token"]).toBe("proj_test");
  expect(capturedHeaders?.authorization).toBeUndefined();
  expect(capturedBody).toContain("proj-id-123");
  expect(snap.configured).toBe(true);
  expect(snap.nodes.license).toEqual({ status: "SUCCESS" });
});
