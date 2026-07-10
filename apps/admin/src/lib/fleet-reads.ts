// Live overlay data for the /architecture diagram (ADR-0316 W-FLEET). The static diagram is baked
// at build time (lib/topology.ts); this module supplies the runtime decoration a client component
// fetches through GET /api/admin/fleet: per-service Railway deploy status + the registry Worker's
// Cloudflare request/error counts.
//
// Env-gated INERT (the /ops dormant pattern): with neither RAILWAY_API_TOKEN nor the Cloudflare
// analytics envs set, the snapshot reports `configured: false` and the overlay renders the static
// diagram unchanged — never a throw, never a socket. Each upstream is INDEPENDENTLY gated and
// INDEPENDENTLY cached at module scope for 60s, so the cockpit can never hammer a vendor API no
// matter how often the page is opened, and any upstream error degrades to an empty overlay (honest
// empty-states rider) rather than failing the whole read.
//
// Vendor response shapes are THIRD-PARTY + versioned, so parsing is defensive object-walking (typed
// guards, not a rigid schema): a field that moved or vanished yields an empty overlay for that
// node, never a throw — the same "degrade to nothing" posture lib/grafana.ts takes with Tempo.
import { fetchWithTimeout } from "@caisson/kernel";

const TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 60_000;
/** CF request/error counts are summed over this trailing window. */
const WORKER_WINDOW_MS = 24 * 60 * 60_000;

export interface NodeOverlay {
  /** Railway latest-deployment status (SUCCESS / CRASHED / FAILED / …) — service nodes only. */
  status?: string;
  /** CF Worker request count over the window — the registry-worker node only. */
  requests?: number;
  /** CF Worker error count over the window — the registry-worker node only. */
  errors?: number;
}

export interface FleetSnapshot {
  configured: boolean;
  /** Keyed by /architecture topology node id (site / admin / docs / license / support-bot /
   *  registry-worker — see lib/topology.ts). A node with no live data simply has no entry. */
  nodes: Record<string, NodeOverlay>;
}

// --- defensive object walking ----------------------------------------------

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function asNumber(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

// --- Railway ---------------------------------------------------------------

const RAILWAY_ENDPOINT = "https://backboard.railway.com/graphql/v2";

// The topology node ids a Railway service name maps onto. Matched by substring so the dashboard's
// `caisson-` prefix is irrelevant; ordered longest-first so a longer id wins if two ever overlap.
const RAILWAY_NODE_IDS = [
  "support-bot",
  "license",
  "admin",
  "docs",
  "site",
] as const;

const RAILWAY_QUERY = `query {
  me { projects { edges { node { services { edges { node {
    name
    serviceInstances { edges { node { latestDeployment { status } } } }
  } } } } } } }
}`;

function railwayToken(): string | null {
  const t = process.env.RAILWAY_API_TOKEN?.trim();
  return t !== undefined && t.length > 0 ? t : null;
}

/** Walk a Railway GraphQL response into { topologyNodeId → latest deploy status }. Degrades to {}. */
export function parseRailwayDeployments(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const projects = asArray(
    asRecord(asRecord(asRecord(asRecord(raw)?.data)?.me)?.projects)?.edges,
  );
  for (const p of projects) {
    const services = asArray(
      asRecord(asRecord(asRecord(p)?.node)?.services)?.edges,
    );
    for (const s of services) {
      const svc = asRecord(asRecord(s)?.node);
      const name = asString(svc?.name)?.toLowerCase();
      if (name === null || name === undefined) continue;
      const nodeId = RAILWAY_NODE_IDS.find((id) => name.includes(id));
      if (nodeId === undefined || out[nodeId] !== undefined) continue;
      const instances = asArray(asRecord(svc?.serviceInstances)?.edges);
      const status = asString(
        asRecord(asRecord(asRecord(instances[0])?.node)?.latestDeployment)
          ?.status,
      );
      if (status !== null) out[nodeId] = status;
    }
  }
  return out;
}

async function fetchRailway(token: string): Promise<Record<string, string>> {
  try {
    const res = await fetchWithTimeout(
      RAILWAY_ENDPOINT,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ query: RAILWAY_QUERY }),
      },
      { timeoutMs: TIMEOUT_MS },
    );
    if (!res.ok) return {};
    return parseRailwayDeployments(await res.json());
  } catch {
    return {};
  }
}

// --- Cloudflare Worker metrics ---------------------------------------------

const CF_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";

// The registry Worker's script name (wrangler `name`). Overridable so a rename doesn't need a code
// change; defaults to the deployed name. lib/topology.ts reads the real name at BUILD time, but this
// runtime module has no repo tree, so the name is a constant/env here (reported in DEPLOY notes).
function workerScriptName(): string {
  return (
    process.env.CLOUDFLARE_WORKER_SCRIPT_NAME?.trim() || "caisson-registry"
  );
}

const CF_QUERY = `query($accountTag: string, $start: string, $end: string, $scriptName: string) {
  viewer { accounts(filter: { accountTag: $accountTag }) {
    workersInvocationsAdaptive(limit: 100, filter: { scriptName: $scriptName, datetime_geq: $start, datetime_leq: $end }) {
      sum { requests errors }
    }
  } }
}`;

function cloudflareEnv(): { token: string; account: string } | null {
  const token = process.env.CLOUDFLARE_ANALYTICS_TOKEN?.trim();
  const account = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (!token || !account) return null;
  return { token, account };
}

/** Sum `requests` + `errors` across a workersInvocationsAdaptive response. Null when absent/garbage.
 *  (The `sum.errors` field is Worker exceptions; CF's Workers dataset does not break out HTTP 429s
 *  specifically, so this reports request volume + error volume — the honest available signal.) */
export function parseWorkerMetrics(
  raw: unknown,
): { requests: number; errors: number } | null {
  const accounts = asArray(
    asRecord(asRecord(asRecord(raw)?.data)?.viewer)?.accounts,
  );
  let requests = 0;
  let errors = 0;
  let seen = false;
  for (const a of accounts) {
    for (const w of asArray(asRecord(a)?.workersInvocationsAdaptive)) {
      const sum = asRecord(asRecord(w)?.sum);
      if (sum === null) continue;
      seen = true;
      requests += asNumber(sum.requests);
      errors += asNumber(sum.errors);
    }
  }
  return seen ? { requests, errors } : null;
}

async function fetchWorker(env: {
  token: string;
  account: string;
}): Promise<NodeOverlay | null> {
  try {
    const now = Date.now();
    const variables = {
      accountTag: env.account,
      start: new Date(now - WORKER_WINDOW_MS).toISOString(),
      end: new Date(now).toISOString(),
      scriptName: workerScriptName(),
    };
    const res = await fetchWithTimeout(
      CF_ENDPOINT,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.token}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ query: CF_QUERY, variables }),
      },
      { timeoutMs: TIMEOUT_MS },
    );
    if (!res.ok) return null;
    const m = parseWorkerMetrics(await res.json());
    return m === null ? null : { requests: m.requests, errors: m.errors };
  } catch {
    return null;
  }
}

// --- 60s module-level cache (per upstream) ---------------------------------

interface Cached<T> {
  at: number;
  value: T;
}
let railwayCache: Cached<Record<string, string>> | null = null;
let workerCache: Cached<NodeOverlay | null> | null = null;

async function cachedRailway(token: string): Promise<Record<string, string>> {
  const now = Date.now();
  if (railwayCache !== null && now - railwayCache.at < CACHE_TTL_MS) {
    return railwayCache.value;
  }
  const value = await fetchRailway(token);
  railwayCache = { at: now, value };
  return value;
}

async function cachedWorker(env: {
  token: string;
  account: string;
}): Promise<NodeOverlay | null> {
  const now = Date.now();
  if (workerCache !== null && now - workerCache.at < CACHE_TTL_MS) {
    return workerCache.value;
  }
  const value = await fetchWorker(env);
  workerCache = { at: now, value };
  return value;
}

/** True when at least one upstream is configured — the overlay only fetches when this holds. */
export function fleetConfigured(): boolean {
  return railwayToken() !== null || cloudflareEnv() !== null;
}

/**
 * The /architecture live overlay read. Dormant env short-circuits to `configured: false` with no
 * network call. Both upstreams run in parallel, each cached 60s; either failing degrades to an
 * empty overlay for its nodes, never a throw.
 */
export async function fetchFleetSnapshot(): Promise<FleetSnapshot> {
  const token = railwayToken();
  const cf = cloudflareEnv();
  if (token === null && cf === null) {
    return { configured: false, nodes: {} };
  }
  const [railway, worker] = await Promise.all([
    token === null
      ? Promise.resolve<Record<string, string>>({})
      : cachedRailway(token),
    cf === null ? Promise.resolve<NodeOverlay | null>(null) : cachedWorker(cf),
  ]);
  const nodes: Record<string, NodeOverlay> = {};
  for (const [id, status] of Object.entries(railway)) {
    nodes[id] = { status };
  }
  if (worker !== null) {
    nodes["registry-worker"] = worker;
  }
  return { configured: true, nodes };
}
