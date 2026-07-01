// SigNoz query-service client (A5, ADR-0142). Env-gated INERT: when SIGNOZ_QUERY_URL or
// SIGNOZ_API_KEY is unset the client is dormant — every query returns a typed empty result,
// never throws, never opens a socket. SigNoz is provisioned at deploy, so the whole ops
// section renders an empty-state in this local build.
//
// Endpoint: POST {SIGNOZ_QUERY_URL}/api/v5/query_range (SigNoz "query_range" v5).
// Request shape confirmed against signoz.io/docs (traces + metrics query-range v5): a
// compositeQuery of builder_query envelopes, each spec = { name, signal, stepInterval,
// aggregations[], filter?, groupBy? }. We only use the traces `expression` aggregation
// form (count(), p90(duration_nano), …) so one builder shape covers every widget.

import { z } from "zod";

import { fetchWithTimeout } from "@caisson/kernel";

const QUERY_TIMEOUT_MS = 10_000;
const WINDOW_MS = 30 * 60_000; // last 30 minutes
const STEP_SEC = 60;
// service.name lives on the OTel resource, not the span (fieldContext = "resource").
const SERVICE_GROUP = {
  name: "service.name",
  fieldContext: "resource",
} as const;

// ---- env gate -------------------------------------------------------------

/** Reads env fresh each call so the gate reflects the live process env (and tests can toggle it). */
function signozEnv(): { url: string; key: string } | null {
  const url = process.env.SIGNOZ_QUERY_URL?.trim();
  const key = process.env.SIGNOZ_API_KEY?.trim();
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ""), key };
}

/** Both envs present → the client can reach a real backend. */
export function signozConfigured(): boolean {
  return signozEnv() !== null;
}

/** Deep-link into the SigNoz UI (self-host: query-service and frontend share an origin). */
export function signozUiUrl(path = "/services"): string | null {
  const url = process.env.SIGNOZ_QUERY_URL?.trim();
  if (!url) return null;
  const base = url.replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

// ---- request model (strict — this is the boundary WE own and send) --------

export type Signal = "traces" | "metrics";

export interface BuilderSpec {
  name: string;
  signal: Signal;
  aggregations: { expression: string; alias?: string }[];
  filter?: { expression: string };
  groupBy?: { name: string; fieldContext?: string }[];
}

// `.strict()` on the request catches builder typos before we hit the wire (the one place
// a strict schema is correct here — see the response note below).
const requestSchema = z
  .object({
    start: z.number(),
    end: z.number(),
    requestType: z.literal("time_series"),
    compositeQuery: z
      .object({
        queries: z
          .array(
            z
              .object({
                type: z.literal("builder_query"),
                spec: z
                  .object({
                    name: z.string(),
                    signal: z.enum(["traces", "metrics"]),
                    stepInterval: z.number(),
                    aggregations: z
                      .array(
                        z
                          .object({
                            expression: z.string(),
                            alias: z.string().optional(),
                          })
                          .strict(),
                      )
                      .min(1),
                    filter: z
                      .object({ expression: z.string() })
                      .strict()
                      .optional(),
                    groupBy: z
                      .array(
                        z
                          .object({
                            name: z.string(),
                            fieldContext: z.string().optional(),
                          })
                          .strict(),
                      )
                      .optional(),
                    disabled: z.boolean(),
                  })
                  .strict(),
              })
              .strict(),
          )
          .min(1),
      })
      .strict(),
  })
  .strict();

// ---- response model -------------------------------------------------------

// The response is a THIRD-PARTY, versioned surface — parse it leniently (`.loose()`) so a
// pinned-then-upgraded SigNoz that adds a field doesn't silently zero the dashboard. We
// safeParse and degrade to [] on any mismatch; nothing here ever throws to the page.
const pointSchema = z.object({
  timestamp: z.number(),
  value: z.union([z.number(), z.string(), z.null()]),
});
const seriesSchema = z
  .object({
    labels: z
      .array(z.object({ key: z.unknown(), value: z.unknown() }).loose())
      .optional(),
    values: z.array(pointSchema).default([]),
  })
  .loose();
const resultSchema = z
  .object({
    queryName: z.string().optional(),
    // v5 nests series under `aggregations[]`; older/scalar variants put it on `series`.
    aggregations: z
      .array(z.object({ series: z.array(seriesSchema).optional() }).loose())
      .optional(),
    series: z.array(seriesSchema).optional(),
  })
  .loose();
const responseSchema = z.object({
  data: z.object({ results: z.array(resultSchema).default([]) }).loose(),
});

export interface SeriesPoint {
  t: number;
  v: number;
}
export interface NamedSeries {
  /** The builder_query name that produced this series (e.g. "requests"). */
  query: string;
  /** groupBy values joined (e.g. "admin"), the series label for a widget. */
  label: string;
  points: SeriesPoint[];
}

function labelOf(labels: { value: unknown }[] | undefined): string {
  if (!labels || labels.length === 0) return "";
  return labels
    .map((l) => String(l.value ?? ""))
    .filter(Boolean)
    .join(" · ");
}

function pointsOf(
  values: { timestamp: number; value: number | string | null }[],
): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (const p of values) {
    if (p.value === null) continue;
    const v = typeof p.value === "string" ? Number(p.value) : p.value;
    if (Number.isNaN(v)) continue;
    out.push({ t: p.timestamp, v });
  }
  return out;
}

/** Flatten a query_range time_series response into normalized `{ query, label, points }` series. */
export function normalizeQueryRangeResponse(raw: unknown): NamedSeries[] {
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) return [];
  const out: NamedSeries[] = [];
  for (const result of parsed.data.data.results) {
    const query = result.queryName ?? "";
    const seriesList =
      result.aggregations?.flatMap((a) => a.series ?? []) ??
      result.series ??
      [];
    for (const s of seriesList) {
      out.push({ query, label: labelOf(s.labels), points: pointsOf(s.values) });
    }
  }
  return out;
}

// ---- query ----------------------------------------------------------------

/**
 * POST a set of builder specs as one composite time_series query and return normalized
 * series. Fully defensive: dormant env, network error, non-2xx, or a parse mismatch all
 * resolve to [] — never throws, never logs the API key.
 */
async function queryRange(specs: BuilderSpec[]): Promise<NamedSeries[]> {
  const env = signozEnv();
  if (!env) return [];
  try {
    const end = Date.now();
    const body = requestSchema.parse({
      start: end - WINDOW_MS,
      end,
      requestType: "time_series",
      compositeQuery: {
        queries: specs.map((s) => ({
          type: "builder_query",
          spec: { ...s, stepInterval: STEP_SEC, disabled: false },
        })),
      },
    });
    const res = await fetchWithTimeout(
      `${env.url}/api/v5/query_range`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "SIGNOZ-API-KEY": env.key,
        },
        body: JSON.stringify(body),
      },
      { timeoutMs: QUERY_TIMEOUT_MS },
    );
    if (!res.ok) return [];
    return normalizeQueryRangeResponse(await res.json());
  } catch {
    return [];
  }
}

// ---- fleet summary widget -------------------------------------------------

export interface ServiceStat {
  service: string;
  requests: number | null;
  errors: number | null;
  p90Ms: number | null;
}
export interface FleetSummary {
  configured: boolean;
  window: { fromMs: number; toMs: number };
  services: ServiceStat[];
}

const sumPoints = (s: NamedSeries): number =>
  s.points.reduce((a, p) => a + p.v, 0);
const lastPoint = (s: NamedSeries): number | null => s.points.at(-1)?.v ?? null;

/**
 * The ops landing widget: request count, error count, and p90 latency per service over the
 * last 30 minutes, in one round trip. Counts are summed across the window; p90 takes the
 * most recent step (current tail latency) and converts ns → ms.
 */
export async function fetchFleetSummary(): Promise<FleetSummary> {
  const toMs = Date.now();
  const window = { fromMs: toMs - WINDOW_MS, toMs };
  if (!signozConfigured()) return { configured: false, window, services: [] };

  const series = await queryRange([
    {
      name: "requests",
      signal: "traces",
      aggregations: [{ expression: "count()", alias: "requests" }],
      groupBy: [SERVICE_GROUP],
    },
    {
      name: "errors",
      signal: "traces",
      aggregations: [{ expression: "count()", alias: "errors" }],
      filter: { expression: "has_error = true" },
      groupBy: [SERVICE_GROUP],
    },
    {
      name: "p90",
      signal: "traces",
      aggregations: [{ expression: "p90(duration_nano)", alias: "p90" }],
      groupBy: [SERVICE_GROUP],
    },
  ]);

  const rows = new Map<string, ServiceStat>();
  const row = (svc: string): ServiceStat => {
    const existing = rows.get(svc);
    if (existing) return existing;
    const created: ServiceStat = {
      service: svc,
      requests: null,
      errors: null,
      p90Ms: null,
    };
    rows.set(svc, created);
    return created;
  };
  for (const s of series) {
    const r = row(s.label || "unknown");
    if (s.query === "requests") r.requests = sumPoints(s);
    else if (s.query === "errors") r.errors = sumPoints(s);
    else if (s.query === "p90") {
      const ns = lastPoint(s);
      r.p90Ms = ns === null ? null : ns / 1e6;
    }
  }

  const services = [...rows.values()].sort(
    (a, b) => (b.requests ?? 0) - (a.requests ?? 0),
  );
  return { configured: true, window, services };
}
