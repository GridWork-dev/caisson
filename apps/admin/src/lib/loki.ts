// Grafana Cloud Loki query client (ADR-0316 W-LOGS). The logs half of the /ops cockpit, mirroring
// lib/grafana.ts (Tempo) exactly — same Grafana Cloud datasource proxy, same `glsa_` bearer, same
// fetchWithTimeout + safeParse-degrade-to-empty contract. The fleet emits TRACES to Tempo and LOGS to
// Loki (both OTLP → Grafana Cloud since ADR-0177); this reads the Loki side so the operator tails logs
// from the same authed cockpit instead of the Grafana Explore second pane.
//
// Env-gated INERT: reuses grafana.ts's two envs (GRAFANA_URL + GRAFANA_QUERY_TOKEN — the SAME `glsa_`
// service-account token, which must carry query access to BOTH datasources) PLUS a NEW
// GRAFANA_LOKI_DATASOURCE_UID. Any one unset → the client is dormant: every query returns a typed
// empty result, never throws, never opens a socket, and the /ops logs panel renders its empty state.
//
// Endpoints (through the datasource proxy, identical proxy shape to Tempo):
//   GET {GRAFANA_URL}/api/datasources/proxy/uid/{uid}/loki/api/v1/query_range?query&start&end&limit&direction
//   GET {GRAFANA_URL}/api/datasources/proxy/uid/{uid}/loki/api/v1/label/service_name/values?start&end
// Auth: `Authorization: Bearer {GRAFANA_QUERY_TOKEN}` (the query-proxy class — the `glc_` write token 401s).
// Verified against the Loki HTTP API docs (grafana.com/docs/loki/latest/reference/loki-http-api):
//   - query_range returns `{ status, data: { resultType:"streams", result: [{ stream:{labels}, values:[[<ns>,<line>]] }] } }`
//   - label-values returns `{ status, data: string[] }`
//   - "All epoch values will be interpreted as a Unix timestamp in NANOSECONDS" — so start/end are
//     nanosecond epochs, NOT the seconds Tempo takes. ms*1e6 = 1.75e18 overflows Number.MAX_SAFE_INTEGER
//     (~9e15), so the ns value is built as a STRING (ms + "000000"), never a float — precision-safe.
// Grafana Cloud auto-derives a `detected_level` structured-metadata label from OTLP severity, so the
// error-level toggle filters on it (`| detected_level =~ "error|critical|fatal"`). OTLP resource
// attribute `service.name` normalizes to the Loki label `service_name` on the Cloud OTLP endpoint.

import { z } from "zod";

import { fetchWithTimeout } from "@caisson/kernel";

const QUERY_TIMEOUT_MS = 10_000;
const WINDOW_MS = 30 * 60_000; // last 30 minutes — matches the /ops trace window
const LIVENESS_WINDOW_MS = 6 * 60 * 60_000; // wider window for the bot-liveness "last line" probe
const LINE_LIMIT = 100; // cap per log-tail read; Loki returns the most-recent `limit` lines

// ---- env gate -------------------------------------------------------------

/** Reads env fresh each call so the gate reflects the live process env (and tests can toggle it). */
function lokiEnv(): { base: string; token: string; uid: string } | null {
  const url = process.env.GRAFANA_URL?.trim();
  const token = process.env.GRAFANA_QUERY_TOKEN?.trim();
  const uid = process.env.GRAFANA_LOKI_DATASOURCE_UID?.trim();
  if (!url || !token || !uid) return null;
  return { base: url.replace(/\/+$/, ""), token, uid };
}

/** All three query envs present → the client can reach the Grafana Cloud Loki proxy. */
export function lokiConfigured(): boolean {
  return lokiEnv() !== null;
}

/** ms epoch → nanosecond epoch as a STRING (never a float — the ns value overflows a JS number). */
function toNanos(ms: number): string {
  return `${String(Math.floor(ms))}000000`;
}

// ---- LogQL builder --------------------------------------------------------

/**
 * Build the LogQL selector for the tail. A `service` narrows to `{service_name="…"}`; absent, it
 * matches every service (`{service_name=~".+"}` — a non-empty matcher, which Loki requires). The
 * `errorsOnly` toggle appends the Grafana-Cloud `detected_level` structured-metadata filter. The
 * `service` value is embedded quoted — the double-quote/backslash escape below keeps a hostile
 * `?logService=` param (an untrusted URL value) from breaking out of the string literal into LogQL.
 * Pure/exported for tests.
 */
export function buildLogQl(opts: {
  service?: string;
  errorsOnly?: boolean;
}): string {
  const selector =
    opts.service !== undefined && opts.service !== ""
      ? `{service_name="${escapeLogQlValue(opts.service)}"}`
      : `{service_name=~".+"}`;
  return opts.errorsOnly === true
    ? `${selector} | detected_level =~ "error|critical|fatal"`
    : selector;
}

function escapeLogQlValue(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// ---- deep-links (Grafana Explore) -----------------------------------------

/**
 * Build a Grafana Explore deep-link that opens the Loki datasource with a LogQL `expr` pre-filled.
 * Mirrors grafana.ts's `buildExploreUrl`, but the Loki datasource query model uses `expr` (not
 * `query`) and `type:"loki"`. Uses the `?left=<json>` Explore state form. Pure/exported for tests.
 */
export function buildLokiExploreUrl(
  base: string,
  uid: string,
  expr: string,
): string {
  const left = {
    datasource: uid,
    queries: [
      {
        refId: "A",
        datasource: { type: "loki", uid },
        editorMode: "code",
        expr,
        queryType: "range",
      },
    ],
    range: { from: "now-30m", to: "now" },
  };
  const qs = new URLSearchParams({ left: JSON.stringify(left) });
  return `${base.replace(/\/+$/, "")}/explore?${qs.toString()}`;
}

/** Env-bound Explore link for a LogQL expr, or null when the client is dormant. */
export function lokiExploreUrl(expr: string): string | null {
  const env = lokiEnv();
  if (!env) return null;
  return buildLokiExploreUrl(env.base, env.uid, expr);
}

// ---- request params (strict — the shape WE own and send) ------------------

// `.strict()` on the owned query params catches a builder typo before it hits the wire — the one place
// strict is correct here (this client is GET-only; there is no owned JSON body to schema).
const queryParamsSchema = z
  .object({
    query: z.string(),
    start: z.string(), // nanosecond epoch, string (see toNanos — precision-safe)
    end: z.string(),
    limit: z.number().int().positive(),
    direction: z.enum(["forward", "backward"]),
  })
  .strict();

// ---- response model (loose — third-party, versioned surface) --------------

// Loki responses are a THIRD-PARTY, versioned surface (the `stats` envelope + structured-metadata
// shape churn across releases). Parse loosely and extract only what a widget needs; every parse is
// safeParse → degrade to [], nothing throws.
const streamSchema = z
  .object({
    stream: z.record(z.string(), z.string()).default({}),
    // each entry is [<ns-timestamp-string>, <log-line-string>] (+ optional metadata trailer).
    values: z.array(z.array(z.unknown())).default([]),
  })
  .loose();
const queryRangeResponseSchema = z
  .object({
    data: z
      .object({ result: z.array(streamSchema).default([]) })
      .loose()
      .default({ result: [] }),
  })
  .loose();

// label-values: `{ status, data: ["svc-a","svc-b"] }`.
const labelValuesResponseSchema = z
  .object({ data: z.array(z.string()).default([]) })
  .loose();

export interface LogLine {
  service: string;
  line: string;
  /** log timestamp, ms epoch (for the "N ago" age label). */
  tsMs: number;
  /** Grafana-Cloud `detected_level` when present (info/warn/error/…). */
  level?: string;
}

/**
 * Flatten a Loki `query_range` response into normalized, newest-first log lines (capped at
 * LINE_LIMIT). Merges every stream's values and sorts by timestamp desc, so a multi-service tail is
 * one interleaved list. Degrades to [] on any mismatch.
 */
export function mapLogLines(raw: unknown): LogLine[] {
  const parsed = queryRangeResponseSchema.safeParse(raw);
  if (!parsed.success) return [];
  const out: LogLine[] = [];
  for (const s of parsed.data.data.result) {
    const service = s.stream.service_name ?? s.stream.service ?? "unknown";
    const level = s.stream.detected_level ?? s.stream.level;
    for (const v of s.values) {
      const ns = v[0];
      const line = v[1];
      if (ns === undefined || line === undefined) continue;
      out.push({
        service,
        line: String(line),
        tsMs: Number(ns) / 1e6,
        ...(level !== undefined ? { level } : {}),
      });
    }
  }
  out.sort((a, b) => b.tsMs - a.tsMs);
  return out.slice(0, LINE_LIMIT);
}

/** Distinct, sorted `service_name` label values from a Loki label-values response (→ [] on mismatch). */
export function mapServiceLabels(raw: unknown): string[] {
  const parsed = labelValuesResponseSchema.safeParse(raw);
  if (!parsed.success) return [];
  return [...new Set(parsed.data.data.filter(Boolean))].sort();
}

// ---- query ----------------------------------------------------------------

/** GET through the datasource proxy. Dormant env / network error / non-2xx all resolve to null. */
async function proxyGet(
  path: string,
  params: URLSearchParams,
): Promise<unknown | null> {
  const env = lokiEnv();
  if (!env) return null;
  try {
    const url = `${env.base}/api/datasources/proxy/uid/${encodeURIComponent(env.uid)}${path}?${params.toString()}`;
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          Authorization: `Bearer ${env.token}`,
          Accept: "application/json",
        },
      },
      { timeoutMs: QUERY_TIMEOUT_MS },
    );
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null; // never throws to the page; the widget shows its empty state
  }
}

interface WindowNs {
  startNs: string;
  endNs: string;
}

async function queryRange(logql: string, w: WindowNs): Promise<LogLine[]> {
  const p = queryParamsSchema.parse({
    query: logql,
    start: w.startNs,
    end: w.endNs,
    limit: LINE_LIMIT,
    direction: "backward",
  });
  const params = new URLSearchParams({
    query: p.query,
    start: p.start,
    end: p.end,
    limit: String(p.limit),
    direction: p.direction,
  });
  const raw = await proxyGet("/loki/api/v1/query_range", params);
  return raw === null ? [] : mapLogLines(raw);
}

async function listServices(w: WindowNs): Promise<string[]> {
  const params = new URLSearchParams({ start: w.startNs, end: w.endNs });
  const raw = await proxyGet("/loki/api/v1/label/service_name/values", params);
  return raw === null ? [] : mapServiceLabels(raw);
}

// ---- logs snapshot (the /ops panel's one round-trip set) ------------------

export interface LogsSnapshot {
  configured: boolean;
  window: { fromMs: number; toMs: number };
  /** `service_name` label inventory over the window (the picker's options). */
  services: string[];
  /** Newest-first log lines for the resolved query (capped at LINE_LIMIT). */
  lines: LogLine[];
  /** The resolved service filter (echoed back for the picker + deep-link). */
  service: string | undefined;
  errorsOnly: boolean;
  /** The exact LogQL sent — feed it to `lokiExploreUrl` for a matching deep-link. */
  query: string;
}

/**
 * The /ops logs read: the `service_name` inventory + the log tail over the last 30 minutes, in two
 * parallel proxy calls. Dormant env short-circuits to an unconfigured empty snapshot. The `service`
 * value is escaped into the LogQL (see buildLogQl), so a bogus `?logService=` param can only return
 * empty — never inject.
 */
export async function fetchLogsSnapshot(
  opts: { service?: string; errorsOnly?: boolean } = {},
): Promise<LogsSnapshot> {
  const errorsOnly = opts.errorsOnly === true;
  const toMs = Date.now();
  const window = { fromMs: toMs - WINDOW_MS, toMs };
  const query = buildLogQl({
    ...(opts.service !== undefined ? { service: opts.service } : {}),
    errorsOnly,
  });
  if (!lokiConfigured()) {
    return {
      configured: false,
      window,
      services: [],
      lines: [],
      service: opts.service,
      errorsOnly,
      query,
    };
  }
  const w: WindowNs = {
    startNs: toNanos(window.fromMs),
    endNs: toNanos(window.toMs),
  };
  const [services, lines] = await Promise.all([
    listServices(w),
    queryRange(query, w),
  ]);
  return {
    configured: true,
    window,
    services,
    lines,
    service: opts.service,
    errorsOnly,
    query,
  };
}

/**
 * The most-recent log line for ONE named service over a wider window (bot-liveness card, W-SUPPORT).
 * A specific-service tail (not the picker), so no `?param` reaches it — `service` is a caller
 * constant. null = dormant env OR the service has emitted nothing in the window (= not redeployed /
 * not logging). Widened to LIVENESS_WINDOW_MS so an idle-but-alive service still shows its last line.
 */
export async function fetchLatestServiceLine(
  service: string,
): Promise<LogLine | null> {
  if (!lokiConfigured()) return null;
  const toMs = Date.now();
  const w: WindowNs = {
    startNs: toNanos(toMs - LIVENESS_WINDOW_MS),
    endNs: toNanos(toMs),
  };
  const lines = await queryRange(buildLogQl({ service }), w);
  return lines[0] ?? null;
}
