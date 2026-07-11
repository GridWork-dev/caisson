// PostHog Query API client (ADR-0316 W-PRODUCT). Server-side, read-only product-analytics panels
// for the /product cockpit page. Env-gated INERT exactly like grafana.ts: when POSTHOG_QUERY_KEY
// / POSTHOG_PROJECT_ID are unset the client is dormant — every read returns a typed empty snapshot,
// never throws, never opens a socket, so a local build renders the "not configured" empty state.
//
// The project (caisson-prod, US Cloud) currently carries ~only `purchase` events at near-zero
// volume, so each panel MUST render an honest "no events yet" empty state (distinct from the
// not-configured one) — never a fabricated figure. `support_answer` traffic arrives once the
// support-bot's battery-v2 ships; until then that panel is genuinely, honestly empty.
//
// Endpoint (verified against posthog.com/docs/api/query, 2026-07):
//   POST {POSTHOG_HOST}/api/projects/{project_id}/query/
//   Body:  { "query": { "kind": "HogQLQuery", "query": "<HogQL SELECT>" } }   (blocking by default)
//   Auth:  Authorization: Bearer <personal API key>   (scope query:read)
//   200:   { "results": [[col0, col1, …], …], "columns": [...], "types": [...], ... }
//          `results` is an array of ROWS, each an array of column values in SELECT order.
import { z } from "zod";

import { fetchWithTimeout } from "@caisson/kernel";

const QUERY_TIMEOUT_MS = 10_000;
const RECENT_LIMIT = 20;
const DEFAULT_HOST = "https://us.posthog.com";

// ---- env gate -------------------------------------------------------------

/** Reads env fresh each call so the gate reflects the live process env (and tests can toggle it).
 *  `POSTHOG_HOST` is optional (defaults to US Cloud); the key + project id are the required pair. */
function posthogEnv(): {
  host: string;
  token: string;
  projectId: string;
} | null {
  const token = process.env.POSTHOG_QUERY_KEY?.trim();
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
  if (!token || !projectId) return null;
  const host = (process.env.POSTHOG_HOST?.trim() || DEFAULT_HOST).replace(
    /\/+$/,
    "",
  );
  return { host, token, projectId };
}

/** Both required envs present → the client can reach the PostHog Query API. */
export function posthogConfigured(): boolean {
  return posthogEnv() !== null;
}

// ---- response model (loose — third-party, versioned surface) --------------

// PostHog's query envelope carries many fields that churn across releases; parse loosely and take
// only `results` (the row matrix). safeParse → null on any mismatch; nothing thrown to the page.
const queryResponseSchema = z
  .object({
    results: z.array(z.array(z.unknown())).default([]),
  })
  .loose();

/**
 * Run one HogQL query, returning its result rows (array-of-arrays) — or `null` on dormant env,
 * network error, non-2xx, or a shape mismatch. Never throws to the page.
 */
async function queryHogql(hogql: string): Promise<unknown[][] | null> {
  const env = posthogEnv();
  if (!env) return null;
  try {
    const url = `${env.host}/api/projects/${encodeURIComponent(env.projectId)}/query/`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query: { kind: "HogQLQuery", query: hogql },
        }),
      },
      { timeoutMs: QUERY_TIMEOUT_MS },
    );
    if (!res.ok) return null;
    const parsed = queryResponseSchema.safeParse(await res.json());
    return parsed.success ? parsed.data.results : null;
  } catch {
    return null; // never throws; the panel shows its empty/unreachable state
  }
}

// ---- HogQL panels ---------------------------------------------------------

const PURCHASE_COUNT_HOGQL =
  "SELECT count() FROM events WHERE event = 'purchase'";
const RECENT_PURCHASES_HOGQL = `SELECT toString(timestamp), distinct_id FROM events WHERE event = 'purchase' ORDER BY timestamp DESC LIMIT ${String(RECENT_LIMIT)}`;
// `support_answer` carries a `confidence` property (a bucket or score); distribution = count per bucket.
const CONFIDENCE_HOGQL =
  "SELECT toString(properties.confidence) AS bucket, count() AS n FROM events WHERE event = 'support_answer' GROUP BY bucket ORDER BY n DESC";

export interface RecentPurchase {
  timestamp: string;
  distinctId: string;
}

export interface ConfidenceBucket {
  bucket: string;
  count: number;
}

export interface ProductSnapshot {
  /** Both PostHog envs present. When false the page renders the not-configured EmptyState. */
  configured: boolean;
  /** false when configured but the live count query hard-failed (network/non-2xx) — the page then
   *  shows a "reachable?" note rather than a fabricated "no events yet". */
  reachable: boolean;
  purchaseCount: number;
  recentPurchases: RecentPurchase[];
  confidence: ConfidenceBucket[];
}

const DORMANT: ProductSnapshot = {
  configured: false,
  reachable: true,
  purchaseCount: 0,
  recentPurchases: [],
  confidence: [],
};

/**
 * Fold the three (possibly-null) HogQL result matrices into a configured snapshot. Pure — no IO — so
 * the column-index → panel mapping is testable without a live PostHog. A `null` count matrix (the
 * query hard-failed) flags `reachable: false`; a null recent/confidence matrix degrades to an honest
 * empty panel; a null/absent confidence bucket renders `—`, never a fabricated label.
 */
export function buildProductSnapshot(
  countRows: unknown[][] | null,
  recentRows: unknown[][] | null,
  confidenceRows: unknown[][] | null,
): ProductSnapshot {
  return {
    configured: true,
    reachable: countRows !== null,
    purchaseCount: Number(countRows?.[0]?.[0] ?? 0),
    recentPurchases: (recentRows ?? []).map((r) => ({
      timestamp: String(r[0] ?? ""),
      distinctId: String(r[1] ?? ""),
    })),
    confidence: (confidenceRows ?? []).map((r) => ({
      bucket: r[0] === null || r[0] === undefined ? "—" : String(r[0]),
      count: Number(r[1] ?? 0),
    })),
  };
}

/**
 * The /product landing read: the purchase count, the most recent purchases, and the support-answer
 * confidence distribution, in three parallel HogQL queries. Dormant env short-circuits to the
 * not-configured empty snapshot; a hard failure of the count query flags `reachable: false`.
 */
export async function fetchProductSnapshot(): Promise<ProductSnapshot> {
  if (!posthogConfigured()) return DORMANT;
  const [countRows, recentRows, confidenceRows] = await Promise.all([
    queryHogql(PURCHASE_COUNT_HOGQL),
    queryHogql(RECENT_PURCHASES_HOGQL),
    queryHogql(CONFIDENCE_HOGQL),
  ]);
  return buildProductSnapshot(countRows, recentRows, confidenceRows);
}
