// The internal scheduler — the default runner (ADR-0286 §5). One `setInterval` per watcher at
// its configured cadence, each independently invocable via `runWatcher` (the same function the
// CLI drives per-leg). No overlap guard beyond `running`: a watcher whose fetch fan-out ever runs
// longer than its own cadence skips that tick rather than piling up concurrent runs against the
// same watch_state keys.
import { enrichFindings } from "./llm.ts";
import { logger } from "./logger.ts";
import type { Config } from "./config.ts";
import type { Fetcher } from "./http.ts";
import type { Store } from "./store.ts";
import type { Watcher } from "./watchers/types.ts";
import { WATCHERS } from "./watchers/index.ts";

export interface RunSummary {
  watcher: string;
  status: "ok" | "error";
  findingsCount: number;
  error?: string;
}

/** Run one watcher to completion: detect → optional LLM enrichment → persist → run ledger.
 *  Never throws — a watcher failure is recorded on the run row and returned in the summary. */
export async function runWatcher(
  watcher: Watcher,
  config: Config,
  store: Store,
  fetchImpl: Fetcher,
  now: () => number = Date.now,
): Promise<RunSummary> {
  const runId = await store.startRun(watcher.name);
  try {
    const detected = await watcher.run({
      config,
      store,
      fetchImpl,
      now,
      logger,
    });
    const enriched = await enrichFindings(detected, config, fetchImpl);
    for (const finding of enriched) {
      await store.upsertFinding(finding, runId);
    }
    await store.finishRun(runId, "ok", enriched.length);
    logger.info("watcher run ok", {
      watcher: watcher.name,
      findings: enriched.length,
    });
    return {
      watcher: watcher.name,
      status: "ok",
      findingsCount: enriched.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await store.finishRun(runId, "error", 0, message.slice(0, 2000));
    logger.error("watcher run failed", { watcher: watcher.name, err: message });
    return {
      watcher: watcher.name,
      status: "error",
      findingsCount: 0,
      error: message,
    };
  }
}

export interface SchedulerHandle {
  stop(): void;
}

/** Start one interval timer per watcher at its configured cadence. Each watcher also fires once
 *  immediately on boot so a fresh deploy doesn't wait a full cadence for its first signal. */
export function startScheduler(
  config: Config,
  store: Store,
  fetchImpl: Fetcher,
): SchedulerHandle {
  const timers = WATCHERS.map((watcher) => {
    void runWatcher(watcher, config, store, fetchImpl);
    return setInterval(() => {
      void runWatcher(watcher, config, store, fetchImpl);
    }, watcher.cadenceMs(config));
  });
  return {
    stop(): void {
      for (const t of timers) clearInterval(t);
    },
  };
}
