// Grafana Cloud Tempo query client (ADR-0207). Replaces the deleted SigNoz client after the
// ADR-0177 cutover (Grafana Cloud is the fleet's sole OTLP sink; SigNoz was torn down 2026-07-01).
// Env-gated INERT: when GRAFANA_URL / GRAFANA_QUERY_TOKEN / GRAFANA_TEMPO_DATASOURCE_UID are unset the
// client is dormant — every query returns a typed empty result, never throws, never opens a socket. In
// a local build the whole /ops section renders the empty state until those envs are set at deploy.
//
// The fleet emits TRACES ONLY, so the widgets read Tempo (TraceQL) through the Grafana Cloud datasource
// proxy — there is no metric signal to back a request-rate / p90 widget, so those SigNoz widgets are gone.
//
// Endpoints (through the datasource proxy):
//   GET {GRAFANA_URL}/api/datasources/proxy/uid/{uid}/api/search?q={traceql}&limit&start&end   (TraceQL search)
//   GET {GRAFANA_URL}/api/datasources/proxy/uid/{uid}/api/search/tag/service.name/values        (service inventory)
// Auth: `Authorization: Bearer {GRAFANA_QUERY_TOKEN}` — a `glsa_` service-account token (the query-proxy
//   class). The `glc_` Cloud-Access-Policy token only writes to the OTLP gateway and 401s here (ADR-0177).
// Verified against the Grafana Tempo HTTP API docs (grafana.com/docs/tempo/latest/api_docs — /api/search
//   returns `{ traces: TraceSearchMetadata[], metrics }`; /api/search/tag/<tag>/values returns
//   `{ tagValues }`) and Grafana's own deeplink builder (grafana/mcp-grafana tools/navigation.go — the
//   Explore `?left=<json>` state form). `start`/`end` are unix SECONDS. See the phase report for citations.

import { z } from "zod";

import { proxyGet } from "./grafana-proxy.ts";

const QUERY_TIMEOUT_MS = 10_000;
const WINDOW_MS = 30 * 60_000; // last 30 minutes
const TRACE_LIMIT = 20; // cap per trace-list widget; Tempo search returns a bounded list, not a count

// ---- env gate -------------------------------------------------------------

/** Reads env fresh each call so the gate reflects the live process env (and tests can toggle it). */
function grafanaEnv(): { base: string; token: string; uid: string } | null {
  const url = process.env.GRAFANA_URL?.trim();
  const token = process.env.GRAFANA_QUERY_TOKEN?.trim();
  const uid = process.env.GRAFANA_TEMPO_DATASOURCE_UID?.trim();
  if (!url || !token || !uid) return null;
  return { base: url.replace(/\/+$/, ""), token, uid };
}

/** All three query envs present → the client can reach the Grafana Cloud query proxy. */
export function grafanaConfigured(): boolean {
  return grafanaEnv() !== null;
}

// ---- deep-links (Grafana Explore) -----------------------------------------

/**
 * Build a Grafana Explore deep-link that opens the Tempo datasource with a TraceQL `query` pre-filled.
 * `query` may be a TraceQL selector (`{ status = error }`) or a bare trace ID — Grafana's Tempo
 * datasource resolves a 32-hex id as a trace lookup. Uses the `?left=<json>` Explore state form that
 * Grafana's own deeplink tooling emits (backward-compatible in current Grafana). Pure/exported for tests.
 */
export function buildExploreUrl(
  base: string,
  uid: string,
  query: string,
): string {
  const left = {
    datasource: uid,
    queries: [
      {
        refId: "A",
        datasource: { type: "tempo", uid },
        queryType: "traceql",
        query,
      },
    ],
    range: { from: "now-30m", to: "now" },
  };
  const qs = new URLSearchParams({ left: JSON.stringify(left) });
  return `${base.replace(/\/+$/, "")}/explore?${qs.toString()}`;
}

/** Env-bound Explore link, or null when the client is dormant. */
export function grafanaExploreUrl(query: string): string | null {
  const env = grafanaEnv();
  if (!env) return null;
  return buildExploreUrl(env.base, env.uid, query);
}

// ---- request params (strict — this is the shape WE own and send) ----------

// `.strict()` on the owned search params catches a builder typo (wrong key) before it hits the wire —
// the one place strict is correct here. This client is GET-only (query params, no owned JSON body), so
// unlike the old SigNoz client there is no request BODY schema; this params object is the owned surface.
const searchParamsSchema = z
  .object({
    q: z.string(),
    limit: z.number().int().positive(),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
  })
  .strict();

// ---- response model (loose — third-party, versioned surface) --------------

// Tempo responses are a THIRD-PARTY, versioned surface: the search envelope carries a `metrics` object
// and each trace a `spanSets[]` / `serviceStats` map whose fields churn across Tempo releases. Parse
// loosely (`.loose()`) and extract only what a widget needs, so a pinned-then-upgraded Tempo that adds a
// field doesn't silently zero the dashboard. Every parse is safeParse → degrade to []; nothing throws.
const traceMetaSchema = z
  .object({
    traceID: z.string(),
    rootServiceName: z.string().optional(),
    rootTraceName: z.string().optional(),
    // uint64 nanos, serialized as a string in JSON (sometimes a number); absent on zero-duration roots.
    startTimeUnixNano: z.union([z.string(), z.number()]).optional(),
    durationMs: z.number().optional(),
  })
  .loose();
const searchResponseSchema = z
  .object({ traces: z.array(traceMetaSchema).default([]) })
  .loose();

// Tag-values: v1 returns `["a","b"]`, v2 returns `[{ type, value }]` — accept both.
const tagValuesResponseSchema = z
  .object({
    tagValues: z
      .array(z.union([z.string(), z.object({ value: z.string() }).loose()]))
      .default([]),
  })
  .loose();

export interface TraceRow {
  traceId: string;
  service: string;
  name: string;
  durationMs: number;
  /** span start, ms epoch (0 when Tempo omitted it) — for the "N ago" age label. */
  startMs: number;
}

/** Flatten a Tempo `/api/search` response into normalized trace rows (degrades to [] on any mismatch). */
export function mapTraces(raw: unknown): TraceRow[] {
  const parsed = searchResponseSchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.traces.map((t) => ({
    traceId: t.traceID,
    service: t.rootServiceName || "unknown",
    name: t.rootTraceName ?? "",
    durationMs: t.durationMs ?? 0,
    startMs:
      t.startTimeUnixNano === undefined ? 0 : Number(t.startTimeUnixNano) / 1e6,
  }));
}

/** Distinct, sorted service names from a Tempo tag-values response (degrades to [] on any mismatch). */
export function mapServiceNames(raw: unknown): string[] {
  const parsed = tagValuesResponseSchema.safeParse(raw);
  if (!parsed.success) return [];
  const names = parsed.data.tagValues.map((v) =>
    typeof v === "string" ? v : v.value,
  );
  return [...new Set(names.filter(Boolean))].sort();
}

// ---- query ----------------------------------------------------------------

interface WindowSec {
  startS: number;
  endS: number;
}

async function searchTraces(
  traceql: string,
  w: WindowSec,
): Promise<TraceRow[]> {
  const p = searchParamsSchema.parse({
    q: traceql,
    limit: TRACE_LIMIT,
    start: w.startS,
    end: w.endS,
  });
  const params = new URLSearchParams({
    q: p.q,
    limit: String(p.limit),
    start: String(p.start),
    end: String(p.end),
  });
  const raw = await proxyGet(grafanaEnv(), "/api/search", params, {
    timeoutMs: QUERY_TIMEOUT_MS,
  });
  return raw === null ? [] : mapTraces(raw);
}

async function listServiceNames(w: WindowSec): Promise<string[]> {
  const params = new URLSearchParams({
    start: String(w.startS),
    end: String(w.endS),
  });
  const raw = await proxyGet(
    grafanaEnv(),
    "/api/search/tag/service.name/values",
    params,
    { timeoutMs: QUERY_TIMEOUT_MS },
  );
  return raw === null ? [] : mapServiceNames(raw);
}

// ---- ops snapshot (the page's one round-trip set) -------------------------

export interface OpsSnapshot {
  configured: boolean;
  window: { fromMs: number; toMs: number };
  /** Active service inventory over the window (Tempo `service.name` tag values). */
  services: string[];
  /** Most recent traces in the window (capped at TRACE_LIMIT). */
  recent: TraceRow[];
  /** Recent `status = error` traces in the window (capped at TRACE_LIMIT). */
  errors: TraceRow[];
}

/**
 * The /ops landing read: the service inventory, recent traces, and error traces over the last 30
 * minutes, in three parallel proxy calls. Dormant env short-circuits to an unconfigured empty snapshot.
 */
export async function fetchOpsSnapshot(): Promise<OpsSnapshot> {
  const toMs = Date.now();
  const window = { fromMs: toMs - WINDOW_MS, toMs };
  if (!grafanaConfigured()) {
    return { configured: false, window, services: [], recent: [], errors: [] };
  }
  const w: WindowSec = {
    startS: Math.floor(window.fromMs / 1000),
    endS: Math.ceil(window.toMs / 1000),
  };
  const [services, recent, errors] = await Promise.all([
    listServiceNames(w),
    searchTraces("{}", w),
    searchTraces("{ status = error }", w),
  ]);
  return { configured: true, window, services, recent, errors };
}
