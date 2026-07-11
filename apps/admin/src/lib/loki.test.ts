import { afterEach, beforeEach, expect, mock, test } from "bun:test";

import {
  buildLogQl,
  buildLokiExploreUrl,
  fetchLogsSnapshot,
  lokiConfigured,
  lokiExploreUrl,
  mapLogLines,
  mapServiceLabels,
} from "./loki.ts";

const ENV_KEYS = [
  "GRAFANA_URL",
  "GRAFANA_QUERY_TOKEN",
  "GRAFANA_LOKI_DATASOURCE_UID",
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
function configureEnv(): void {
  process.env.GRAFANA_URL = "https://caisson.grafana.net";
  process.env.GRAFANA_QUERY_TOKEN = "glsa_test";
  process.env.GRAFANA_LOKI_DATASOURCE_UID = "loki-uid";
}

/** Record every requested URL and return a valid-but-empty Loki response per endpoint. */
function captureFetch(): { urls: string[] } {
  const urls: string[] = [];
  const spy = mock((input: unknown) => {
    const url = String(input);
    urls.push(url);
    const body = url.includes("/query_range")
      ? { data: { result: [] } }
      : { data: [] };
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(body),
    } as unknown as Response);
  });
  globalThis.fetch = spy as unknown as typeof globalThis.fetch;
  return { urls };
}

// (a) Dormant when env unset: empty snapshot, no throw, and — crucially — no socket opened.
test("dormant without env: empty snapshot and no network call", async () => {
  clearEnv();
  const fetchSpy = mock(() => {
    throw new Error("network must not be called when dormant");
  });
  globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

  expect(lokiConfigured()).toBe(false);
  expect(lokiExploreUrl('{service_name=~".+"}')).toBeNull();

  const snap = await fetchLogsSnapshot();
  expect(snap.configured).toBe(false);
  expect(snap.services).toEqual([]);
  expect(snap.lines).toEqual([]);
  expect(fetchSpy).not.toHaveBeenCalled();
});

// (b) Configured only when all three query envs are present (reuses grafana's two + the new Loki uid).
test("lokiConfigured needs all three envs", () => {
  clearEnv();
  process.env.GRAFANA_URL = "https://caisson.grafana.net";
  process.env.GRAFANA_QUERY_TOKEN = "glsa_test";
  expect(lokiConfigured()).toBe(false); // loki uid still missing
  process.env.GRAFANA_LOKI_DATASOURCE_UID = "loki-uid";
  expect(lokiConfigured()).toBe(true);
});

// (c) LogQL builder: all-services vs one service vs error toggle, and quote-escaping the value.
test("buildLogQl composes selector + level filter and escapes the service value", () => {
  expect(buildLogQl({})).toBe('{service_name=~".+"}');
  expect(buildLogQl({ service: "service-license" })).toBe(
    '{service_name="service-license"}',
  );
  expect(buildLogQl({ errorsOnly: true })).toBe(
    '{service_name=~".+"} | detected_level =~ "error|critical|fatal"',
  );
  expect(buildLogQl({ service: "service-license", errorsOnly: true })).toBe(
    '{service_name="service-license"} | detected_level =~ "error|critical|fatal"',
  );
  // A hostile value with a double-quote is escaped, never breaks out of the string literal.
  expect(buildLogQl({ service: 'a"b' })).toBe('{service_name="a\\"b"}');
});

// (d) Explore deep-link: pure builder embeds the Loki datasource + LogQL `expr` in the `left` state.
test("buildLokiExploreUrl embeds loki datasource + expr in Explore left state", () => {
  const url = buildLokiExploreUrl(
    "https://caisson.grafana.net/",
    "loki-uid",
    '{service_name="service-license"}',
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
      expr: string;
      datasource: { type: string; uid: string };
    }[];
  };
  expect(state.datasource).toBe("loki-uid");
  expect(state.queries[0]?.queryType).toBe("range");
  expect(state.queries[0]?.expr).toBe('{service_name="service-license"}');
  expect(state.queries[0]?.datasource).toEqual({
    type: "loki",
    uid: "loki-uid",
  });
});

// (e) A sample Loki query_range response flattens into normalized, newest-first rows.
test("mapLogLines flattens streams, sorts newest-first, carries level, and caps", () => {
  const sample = {
    status: "success",
    data: {
      resultType: "streams",
      result: [
        {
          stream: { service_name: "service-license", detected_level: "info" },
          values: [
            ["3000000", "A-new"], // 3ms
            ["1000000", "A-old"], // 1ms
          ],
        },
        {
          stream: { service_name: "service-support-bot" }, // no level label
          values: [
            ["2000000", "B-mid"], // 2ms
            ["2000000", "B-mid2", { trace_id: "x" }], // extra metadata trailer: ignored
          ],
        },
      ],
      stats: { ingester: { totalBatches: 1 } }, // versioned envelope field: passthrough
    },
  };

  const rows = mapLogLines(sample);
  expect(rows).toHaveLength(4);

  // Newest first: 3ms, then the two 2ms lines, then 1ms.
  expect(rows[0]).toEqual({
    service: "service-license",
    line: "A-new",
    tsMs: 3,
    level: "info",
  });
  expect(rows[3]).toEqual({
    service: "service-license",
    line: "A-old",
    tsMs: 1,
    level: "info",
  });
  // The two middle (ts=2) rows are the support-bot lines: no level, ns→ms exact.
  const mids = rows.filter((r) => r.tsMs === 2);
  expect(mids).toHaveLength(2);
  expect(mids.every((r) => r.service === "service-support-bot")).toBe(true);
  expect(mids.every((r) => r.level === undefined)).toBe(true);
});

// (f) Label-values response → distinct, sorted service names.
test("mapServiceLabels dedupes + sorts the label values", () => {
  expect(
    mapServiceLabels({
      status: "success",
      data: ["service-site", "service-docs", "service-admin", "service-docs"],
    }),
  ).toEqual(["service-admin", "service-docs", "service-site"]);
});

test("garbage input degrades to [] instead of throwing", () => {
  expect(mapLogLines(null)).toEqual([]);
  expect(mapLogLines({ nope: true })).toEqual([]);
  expect(mapServiceLabels(null)).toEqual([]);
  expect(mapServiceLabels({ nope: true })).toEqual([]);
});

// (g) THE nanosecond footgun: start/end must be full-precision nanosecond epoch STRINGS. A float
// ms*1e6 would drift (ns overflows Number.MAX_SAFE_INTEGER); prove the window is exactly 30 min in ns
// via BigInt (clock-independent) and that the params are pure-digit ns strings, not seconds.
test("query_range sends precise nanosecond epoch strings (30-min window, no float drift)", async () => {
  configureEnv();
  const { urls } = captureFetch();

  await fetchLogsSnapshot();

  const rangeUrl = urls.find((u) => u.includes("/query_range"));
  expect(rangeUrl).toBeDefined();
  const params = new URL(rangeUrl ?? "").searchParams;
  const start = params.get("start") ?? "";
  const end = params.get("end") ?? "";

  // Pure-digit nanosecond strings (13-digit ms + 6 zeros ≈ 19 digits), never seconds/floats.
  expect(/^\d+000000$/.test(start)).toBe(true);
  expect(/^\d+000000$/.test(end)).toBe(true);
  expect(start.length).toBeGreaterThanOrEqual(19);
  // Exactly 30 minutes apart, in nanoseconds (1800 s × 1e9) — BigInt, so no double-rounding passes.
  expect(BigInt(end) - BigInt(start)).toBe(1_800_000_000_000n);
  expect(params.get("direction")).toBe("backward");
});
