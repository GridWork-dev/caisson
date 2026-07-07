// SOC 2 watcher: a monthly content-hash check of the AICPA SOC 2 resources page. Separate from
// the daily compliance watcher because its cadence is monthly. Baseline-then-change: the first
// run records the hash silently; a later run emits when the page content moves.
import { contentHash } from "../detect.ts";
import { dedupKey } from "../finding.ts";
import { fetchText } from "../http.ts";
import type { Finding } from "../finding.ts";
import type { Watcher, WatcherCtx } from "./types.ts";

const SOC2_URL =
  "https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2";
const STATE_KEY = "soc2:aicpa:hash";

export function detectSoc2Change(
  text: string,
  prev: Record<string, string>,
): { findings: Finding[]; nextState: Record<string, string> } {
  const current = contentHash(text);
  const before = prev[STATE_KEY];
  const findings: Finding[] = [];
  if (before !== undefined && before !== current) {
    findings.push({
      source: "soc2",
      kind: "framework_change",
      severity: "info",
      title: "AICPA SOC 2 resources page changed",
      body: "The AICPA SOC 2 resources page content changed since the last monthly check — review it for guidance updates that affect the SOC 2 mappings.",
      dedupKey: dedupKey("soc2", "aicpa", current),
      payload: { url: SOC2_URL, previous: before, current },
    });
  }
  return { findings, nextState: { [STATE_KEY]: current } };
}

export const soc2Watcher: Watcher = {
  name: "soc2",
  cadenceMs: (config) => config.cadenceSoc2Ms,
  async run(ctx: WatcherCtx): Promise<Finding[]> {
    const prev = await ctx.store.getWatchState([STATE_KEY]);
    let text: string;
    try {
      text = await fetchText(ctx.fetchImpl, SOC2_URL);
    } catch (err) {
      ctx.logger.warn("soc2 source fetch failed", {
        err: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
    const { findings, nextState } = detectSoc2Change(text, prev);
    await ctx.store.setWatchState(nextState);
    return findings;
  },
};
