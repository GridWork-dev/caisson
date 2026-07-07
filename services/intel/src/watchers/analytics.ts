// Analytics rollup watcher: one dated rollup finding per day from PostHog (event + user counts
// via the query API) and Plausible (visitors + pageviews via the stats API). This is a rollup,
// not change detection — it always emits, deduped on the date so same-day re-runs reinforce the
// one row. Either source absent (no key) self-skips; both absent ⇒ no finding.
import { z } from "zod";
import { dedupKey } from "../finding.ts";
import { fetchJson } from "../http.ts";
import { createPostHogClient } from "../posthog.ts";
import type { DailyRollup } from "../posthog.ts";
import type { Fetcher } from "../http.ts";
import type { Config } from "../config.ts";
import type { Finding } from "../finding.ts";
import type { Watcher, WatcherCtx } from "./types.ts";

export interface PlausibleRollup {
  visitors: number;
  pageviews: number;
}

const PlausibleResponse = z.object({
  results: z
    .object({
      visitors: z.object({ value: z.number() }).optional(),
      pageviews: z.object({ value: z.number() }).optional(),
    })
    .optional(),
});

export function parsePlausible(raw: unknown): PlausibleRollup {
  const parsed = PlausibleResponse.safeParse(raw);
  const r = parsed.success ? parsed.data.results : undefined;
  return {
    visitors: Math.trunc(r?.visitors?.value ?? 0),
    pageviews: Math.trunc(r?.pageviews?.value ?? 0),
  };
}

async function fetchPlausible(
  config: Config,
  fetchImpl: Fetcher,
): Promise<PlausibleRollup | null> {
  if (
    config.plausibleApiKey === undefined ||
    config.plausibleSiteId === undefined
  )
    return null;
  const url =
    `${config.plausibleApiHost.replace(/\/+$/, "")}/api/v1/stats/aggregate` +
    `?site_id=${encodeURIComponent(config.plausibleSiteId)}&period=day&metrics=visitors,pageviews`;
  const raw = await fetchJson<unknown>(fetchImpl, url, {
    headers: { authorization: `Bearer ${config.plausibleApiKey}` },
  });
  return parsePlausible(raw);
}

/** The UTC date stamp (YYYY-MM-DD) that keys the day's rollup. */
export function dateStamp(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function buildRollupFinding(
  nowMs: number,
  posthog: DailyRollup | null,
  plausible: PlausibleRollup | null,
): Finding {
  const date = dateStamp(nowMs);
  const parts: string[] = [];
  if (posthog !== null)
    parts.push(
      `${String(posthog.events)} events, ${String(posthog.users)} users (PostHog)`,
    );
  if (plausible !== null)
    parts.push(
      `${String(plausible.visitors)} visitors, ${String(plausible.pageviews)} pageviews (Plausible)`,
    );
  return {
    source: "analytics",
    kind: "rollup",
    severity: "info",
    title: `Daily analytics rollup ${date}`,
    body:
      parts.length > 0
        ? parts.join("; ")
        : "No analytics sources were reachable for this rollup.",
    dedupKey: dedupKey("analytics", "rollup", date),
    payload: {
      date,
      ...(posthog !== null
        ? { events: posthog.events, users: posthog.users }
        : {}),
      ...(plausible !== null
        ? { visitors: plausible.visitors, pageviews: plausible.pageviews }
        : {}),
    },
  };
}

export const analyticsWatcher: Watcher = {
  name: "analytics",
  cadenceMs: (config) => config.cadenceAnalyticsMs,
  async run(ctx: WatcherCtx): Promise<Finding[]> {
    const posthogClient = createPostHogClient(ctx.config, ctx.fetchImpl);
    let posthog: DailyRollup | null = null;
    if (posthogClient !== null) {
      try {
        posthog = await posthogClient.dailyRollup();
      } catch (err) {
        ctx.logger.warn("posthog rollup failed", {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
    let plausible: PlausibleRollup | null = null;
    try {
      plausible = await fetchPlausible(ctx.config, ctx.fetchImpl);
    } catch (err) {
      ctx.logger.warn("plausible rollup failed", {
        err: err instanceof Error ? err.message : String(err),
      });
    }
    if (posthog === null && plausible === null) return [];
    return [buildRollupFinding(ctx.now(), posthog, plausible)];
  },
};
