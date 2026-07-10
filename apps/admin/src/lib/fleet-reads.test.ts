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

test("parseRailwayDeployments degrades to {} on garbage", () => {
  expect(parseRailwayDeployments(null)).toEqual({});
  expect(parseRailwayDeployments({ nope: true })).toEqual({});
  expect(parseRailwayDeployments({ data: { me: null } })).toEqual({});
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
