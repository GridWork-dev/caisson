// Competitor watch: per-URL content-hash change detection over a CONFIGURED list
// (`INTEL_COMPETITOR_URLS`, data not code — start with a handful of pricing/changelog pages).
// Baseline-then-change per URL; the daemon has no opinion on what changed, only that it did.
// ponytail: whole-page hash — a heavily dynamic page can false-positive; narrow to a CSS-selected
// region only if a specific competitor's page proves too noisy.
import { contentHash, detectionHash } from "../detect.ts";
import { dedupKey } from "../finding.ts";
import { fetchText } from "../http.ts";
import type { Finding } from "../finding.ts";
import type { Watcher, WatcherCtx } from "./types.ts";

/** Stable, filesystem-safe state key for a URL (first 16 hex of its hash). */
function urlKey(url: string): string {
  return contentHash(url).slice(0, 16);
}

export function competitorStateKeys(urls: readonly string[]): string[] {
  return urls.map((u) => `competitor:${urlKey(u)}:hash`);
}

export interface FetchedPage {
  url: string;
  text: string;
}

export function detectCompetitorChanges(
  pages: readonly FetchedPage[],
  prev: Record<string, string>,
): { findings: Finding[]; nextState: Record<string, string> } {
  const findings: Finding[] = [];
  const nextState: Record<string, string> = {};
  for (const { url, text } of pages) {
    const key = `competitor:${urlKey(url)}:hash`;
    const current = detectionHash(text);
    // Empty/challenge/maintenance body — skip this URL entirely, leaving its stored baseline
    // untouched, rather than let a blank fetch look like a change on the next real one.
    if (current === null) continue;
    const before = prev[key];
    if (before !== undefined && before !== current) {
      findings.push({
        source: "competitor",
        kind: "page_diff",
        severity: "info",
        title: `Competitor page changed: ${hostOf(url)}`,
        body: `Watched page ${url} changed content since the last check.`,
        dedupKey: dedupKey("competitor", urlKey(url), current.slice(0, 16)),
        payload: { url, previous: before, current },
      });
    }
    nextState[key] = current;
  }
  return { findings, nextState };
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export const competitorWatcher: Watcher = {
  name: "competitor",
  cadenceMs: (config) => config.cadenceCompetitorMs,
  async run(ctx: WatcherCtx): Promise<Finding[]> {
    const urls = ctx.config.competitorUrls;
    if (urls.length === 0) return [];
    const prev = await ctx.store.getWatchState(competitorStateKeys(urls));

    const pages: FetchedPage[] = [];
    for (const url of urls) {
      try {
        pages.push({ url, text: await fetchText(ctx.fetchImpl, url) });
      } catch (err) {
        ctx.logger.warn("competitor page fetch failed", {
          url,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
    const { findings, nextState } = detectCompetitorChanges(pages, prev);
    await ctx.store.setWatchState(nextState);
    return findings;
  },
};
