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

const ErrorIssue = z.object({
  id: z.string(),
  name: z.string().optional(),
  occurrences: z.number().optional(),
  volume: z.number().optional(),
  count: z.number().optional(),
});
const ErrorResponse = z.object({ results: z.array(ErrorIssue) });

/** Map a PostHog error-tracking issues response to normalized groups. Occurrence count is read
 *  from whichever count field the payload carries (occurrences/volume/count), defaulting to 1. */
export function parseErrorGroups(raw: unknown): ErrorGroup[] {
  const parsed = ErrorResponse.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.results.map((r) => ({
    fingerprint: r.id,
    name: r.name ?? r.id,
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
      return parseErrorGroups(raw);
    },
  };
}
