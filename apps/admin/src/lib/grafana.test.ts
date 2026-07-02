import { afterEach, beforeEach, expect, mock, test } from "bun:test";

import {
  buildExploreUrl,
  fetchOpsSnapshot,
  grafanaConfigured,
  grafanaExploreUrl,
  mapServiceNames,
  mapTraces,
} from "./grafana.ts";

const ENV_KEYS = [
  "GRAFANA_URL",
  "GRAFANA_QUERY_TOKEN",
  "GRAFANA_TEMPO_DATASOURCE_UID",
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

// (a) Dormant when env unset: empty snapshot, no throw, and — crucially — no socket opened.
test("dormant without env: empty snapshot and no network call", async () => {
  clearEnv();
  const fetchSpy = mock(() => {
    throw new Error("network must not be called when dormant");
  });
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

  expect(grafanaConfigured()).toBe(false);
  expect(grafanaExploreUrl("{}")).toBeNull();

  const snap = await fetchOpsSnapshot();
  expect(snap).toEqual({
    configured: false,
    window: snap.window,
    services: [],
    recent: [],
    errors: [],
  });
  expect(fetchSpy).not.toHaveBeenCalled();
});

// (b) Configured only when all three query envs are present.
test("grafanaConfigured needs all three envs", () => {
  clearEnv();
  process.env.GRAFANA_URL = "https://caisson.grafana.net";
  process.env.GRAFANA_QUERY_TOKEN = "glsa_test";
  expect(grafanaConfigured()).toBe(false); // uid still missing
  process.env.GRAFANA_TEMPO_DATASOURCE_UID = "tempo-uid";
  expect(grafanaConfigured()).toBe(true);
});

// (c) Explore deep-link: pure builder embeds datasource + TraceQL query in the `left` state.
test("buildExploreUrl embeds datasource + traceql query in Explore left state", () => {
  const url = buildExploreUrl(
    "https://caisson.grafana.net/",
    "tempo-uid",
    "{ status = error }",
  );
  expect(url.startsWith("https://caisson.grafana.net/explore?left=")).toBe(
    true,
  );

  const left = new URL(url).searchParams.get("left");
  expect(left).not.toBeNull();
  const state = JSON.parse(left ?? "{}") as {
    datasource: string;
    queries: {
      queryType: string;
      query: string;
      datasource: { type: string; uid: string };
    }[];
  };
  expect(state.datasource).toBe("tempo-uid");
  expect(state.queries[0]?.queryType).toBe("traceql");
  expect(state.queries[0]?.query).toBe("{ status = error }");
  expect(state.queries[0]?.datasource).toEqual({
    type: "tempo",
    uid: "tempo-uid",
  });
});

test("grafanaExploreUrl is env-bound and trims a trailing slash on the base", () => {
  clearEnv();
  process.env.GRAFANA_URL = "https://caisson.grafana.net/";
  process.env.GRAFANA_QUERY_TOKEN = "glsa_test";
  process.env.GRAFANA_TEMPO_DATASOURCE_UID = "tempo-uid";
  const url = grafanaExploreUrl("abc123def456");
  expect(url?.startsWith("https://caisson.grafana.net/explore?left=")).toBe(
    true,
  );
});

// (d) A sample Tempo /api/search response maps into normalized rows.
test("mapTraces normalizes a Tempo search response", () => {
  const sample = {
    traces: [
      {
        traceID: "2f3e0cee77ae5dc9c17ade3689eb2e54",
        rootServiceName: "license",
        rootTraceName: "POST /verify",
        startTimeUnixNano: "1684778327699392724", // string nanos
        durationMs: 557,
        spanSets: [{ spans: [], matched: 1 }], // extra field: passthrough, ignored
      },
      {
        traceID: "1b1ba462b409200d",
        // no rootServiceName / rootTraceName / durationMs — a partial/zero-duration root
        startTimeUnixNano: "1684778327699000000",
      },
    ],
    metrics: { totalBlocks: 13 }, // versioned envelope field: passthrough, ignored
  };

  const rows = mapTraces(sample);
  expect(rows).toHaveLength(2);

  expect(rows[0]).toEqual({
    traceId: "2f3e0cee77ae5dc9c17ade3689eb2e54",
    service: "license",
    name: "POST /verify",
    durationMs: 557,
    startMs: 1684778327699.3928,
  });

  // Missing fields fall back cleanly.
  expect(rows[1]?.service).toBe("unknown");
  expect(rows[1]?.name).toBe("");
  expect(rows[1]?.durationMs).toBe(0);
});

// (e) Tag-values: both the v1 (strings) and v2 ({value}) shapes normalize + dedup + sort.
test("mapServiceNames handles v1 strings and v2 objects, deduped + sorted", () => {
  expect(
    mapServiceNames({ tagValues: ["site", "docs", "admin", "docs"] }),
  ).toEqual(["admin", "docs", "site"]);
  expect(
    mapServiceNames({
      tagValues: [
        { type: "string", value: "support-bot" },
        { type: "string", value: "license" },
      ],
    }),
  ).toEqual(["license", "support-bot"]);
});

test("garbage input degrades to [] instead of throwing", () => {
  expect(mapTraces(null)).toEqual([]);
  expect(mapTraces({ nope: true })).toEqual([]);
  expect(mapServiceNames(null)).toEqual([]);
  expect(mapServiceNames({ nope: true })).toEqual([]);
});
