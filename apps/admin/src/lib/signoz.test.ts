import { afterEach, beforeEach, expect, mock, test } from "bun:test";

import {
  fetchFleetSummary,
  normalizeQueryRangeResponse,
  signozConfigured,
  signozUiUrl,
} from "./signoz.ts";

const ENV_KEYS = ["SIGNOZ_QUERY_URL", "SIGNOZ_API_KEY"] as const;
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

// (a) Dormant when env unset: empty result, no throw, and — crucially — no socket opened.
test("dormant without env: empty result and no network call", async () => {
  delete process.env.SIGNOZ_QUERY_URL;
  delete process.env.SIGNOZ_API_KEY;

  const fetchSpy = mock(() => {
    throw new Error("network must not be called when dormant");
  });
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

  expect(signozConfigured()).toBe(false);
  expect(signozUiUrl()).toBeNull();

  const summary = await fetchFleetSummary();
  expect(summary).toEqual({
    configured: false,
    window: summary.window,
    services: [],
  });
  expect(fetchSpy).not.toHaveBeenCalled();
});

test("signozUiUrl deep-links off the query URL, trimming trailing slashes", () => {
  process.env.SIGNOZ_QUERY_URL = "https://signoz.internal/";
  expect(signozUiUrl()).toBe("https://signoz.internal/services");
  expect(signozUiUrl("/traces")).toBe("https://signoz.internal/traces");
});

// (b) A sample v5 /api/v5/query_range time_series body parses + normalizes into series.
test("normalizes a v5 query_range time_series response", () => {
  const sample = {
    status: "success",
    data: {
      type: "time_series",
      results: [
        {
          queryName: "requests",
          aggregations: [
            {
              index: 0,
              alias: "requests",
              series: [
                {
                  labels: [{ key: { name: "service.name" }, value: "admin" }],
                  values: [
                    { timestamp: 1000, value: 5 },
                    { timestamp: 1060, value: 7 },
                  ],
                },
                {
                  labels: [{ key: { name: "service.name" }, value: "worker" }],
                  // value as a numeric string + a null gap — both handled.
                  values: [
                    { timestamp: 1000, value: "2" },
                    { timestamp: 1060, value: null },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };

  const series = normalizeQueryRangeResponse(sample);
  expect(series).toHaveLength(2);

  const admin = series.find((s) => s.label === "admin");
  expect(admin?.query).toBe("requests");
  expect(admin?.points).toEqual([
    { t: 1000, v: 5 },
    { t: 1060, v: 7 },
  ]);

  const worker = series.find((s) => s.label === "worker");
  // "2" coerced to a number; the null gap dropped.
  expect(worker?.points).toEqual([{ t: 1000, v: 2 }]);
});

test("garbage input degrades to [] instead of throwing", () => {
  expect(normalizeQueryRangeResponse(null)).toEqual([]);
  expect(normalizeQueryRangeResponse({ nope: true })).toEqual([]);
});
