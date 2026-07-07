// PostHog read client — the shared source for the analytics rollup and error triage. Reads use
// a personal API key (Bearer). Response parsing is field-picking, NOT strict: PostHog owns these
// shapes and adds fields freely, so `z.object` (which strips unknown keys) is the correct posture
// for a payload we consume but don't define. The pure mappers are unit-tested over fixtures; the
// live fetch is exercised only by the self-skipping live tests.
import { z } from "zod";
import { fetchJson } from "./http.ts";
import type { Fetcher } from "./http.ts";
import type { Config } from "./config.ts";

export interface DailyRollup {
  events: number;
  users: number;
}

export interface ErrorGroup {
  fingerprint: string;
  name: string;
  occurrences: number;
  url?: string;
}

/** PostHog's confirmed error-tracking issue statuses (docs: "issues are marked Active by
 *  default"; `suppressed` shipped in PostHog/posthog#29860; `archived`/`pending_release` were
 *  later deprecated/rejected — PostHog/posthog#59542 — but a read from an older event could
 *  still carry one, so they're excluded defensively too, not just unlisted). Anything outside
 *  this active set is a resolved/muted/stale issue that shouldn't re-alert or re-inflate
 *  seen_count on every 15-minute poll.
 * ponytail: the exact status vocabulary is doc/PR-confirmed, not observed against a live
 * payload — the live test (live/watchers.live.test.ts) asserts the real shape when opted in. */
const ACTIVE_ERROR_STATUSES = new Set(["active"]);

const RollupResponse = z.object({
  results: z.array(z.array(z.unknown())),
});

/** Map a HogQL query response (`results: [[events, users]]`) to the rollup. Missing cells ⇒ 0. */
export function parseRollup(raw: unknown): DailyRollup {
  const parsed = RollupResponse.safeParse(raw);
  const row = parsed.success ? parsed.data.results[0] : undefined;
  const num = (v: unknown): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : 0;
  return { events: num(row?.[0]), users: num(row?.[1]) };
}

const MAX_ERROR_NAME_CHARS = 500;

const ErrorIssue = z.object({
  id: z.string(),
  name: z.string().optional(),
  occurrences: z.number().optional(),
  volume: z.number().optional(),
  count: z.number().optional(),
  status: z.string().optional(),
});
const ErrorResponse = z.object({ results: z.array(ErrorIssue) });

/** Map a PostHog error-tracking issues response to normalized groups. Occurrence count is read
 *  from whichever count field the payload carries (occurrences/volume/count), defaulting to 1.
 *  Resolved/suppressed/stale issues are dropped here — a status outside the confirmed active set
 *  (including a missing status, treated as active per PostHog's own default) never re-alerts or
 *  re-inflates seen_count on a re-poll. `name` is SLICED, not rejected — this string is buyer-
 *  triggerable (a raw exception message) and flows unbounded into a persisted finding's title/
 *  body downstream; a `.max()` in the Zod schema above would drop the WHOLE response on one
 *  oversized name (z.array fails the batch on any element failure), which is worse than
 *  truncating the one field. */
export function parseErrorGroups(raw: unknown): ErrorGroup[] {
  const parsed = ErrorResponse.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.results
    .filter(
      (r) => r.status === undefined || ACTIVE_ERROR_STATUSES.has(r.status),
    )
    .map((r) => ({
      fingerprint: r.id,
      name: (r.name ?? r.id).slice(0, MAX_ERROR_NAME_CHARS),
      occurrences: Math.trunc(r.occurrences ?? r.volume ?? r.count ?? 1),
    }));
}

const DAILY_ROLLUP_HOGQL =
  "SELECT count() AS events, count(DISTINCT person_id) AS users " +
  "FROM events WHERE timestamp >= now() - INTERVAL 1 DAY";

export interface PostHogClient {
  dailyRollup(): Promise<DailyRollup>;
  errorGroups(): Promise<ErrorGroup[]>;
}

/** Build the client, or `null` when `POSTHOG_API_KEY` is unset (the leg self-skips). */
export function createPostHogClient(
  config: Config,
  fetchImpl: Fetcher,
): PostHogClient | null {
  const key = config.posthogApiKey;
  if (key === undefined || key.length === 0) return null;
  const base = `${config.posthogApiHost.replace(/\/+$/, "")}/api/projects/${config.posthogProjectId}`;
  const headers = {
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };

  return {
    async dailyRollup(): Promise<DailyRollup> {
      const raw = await fetchJson<unknown>(fetchImpl, `${base}/query/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: { kind: "HogQLQuery", query: DAILY_ROLLUP_HOGQL },
        }),
      });
      return parseRollup(raw);
    },
    async errorGroups(): Promise<ErrorGroup[]> {
      const raw = await fetchJson<unknown>(
        fetchImpl,
        `${base}/error_tracking/issues/`,
        {
          headers,
        },
      );
      // The PostHog app's own error-tracking issue URL — points the operator at a real,
      // navigable page for the issue (the API response carries no such link itself).
      const dashboardHost = config.posthogApiHost.replace(/\/+$/, "");
      return parseErrorGroups(raw).map((group) => ({
        ...group,
        url: `${dashboardHost}/project/${config.posthogProjectId}/error_tracking/${group.fingerprint}`,
      }));
    },
  };
}
