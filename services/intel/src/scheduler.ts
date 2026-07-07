// The internal scheduler — the default runner (ADR-0286 §5). One `longInterval` per watcher at
// its configured cadence (see `longInterval` for why NOT a raw `setInterval` — CAISSON-49), each
// independently invocable via `runWatcher` (the same function the
// CLI drives per-leg). `createOverlapGuard` is the real defense the header used to only claim:
// a watcher whose fetch fan-out ever runs longer than its own cadence skips the next tick rather
// than piling up concurrent runs against the same watch_state keys (a concurrent read-modify-write
// race, and — for the error watcher specifically — duplicate Telegram/Linear alerts).
import { enrichFindings } from "./llm.ts";
import { logger } from "./logger.ts";
import type { Config } from "./config.ts";
import type { Finding } from "./finding.ts";
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

/** `finishRun` never rejects `runWatcher` — a transient DB write failure on the run ledger must
 *  never crash-loop the daemon (a Railway PG blip while the watcher itself succeeded shouldn't
 *  turn into an unhandled rejection). Logged and swallowed. */
async function safeFinishRun(
  store: Store,
  runId: string,
  status: "ok" | "error",
  findingsCount: number,
  error?: string,
): Promise<void> {
  try {
    await store.finishRun(runId, status, findingsCount, error);
  } catch (err) {
    logger.error("finishRun failed — the run ledger row was not updated", {
      runId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/** A rollup (emitted every run by design, never a "change") and a re-observed error group whose
 *  alert was NOT freshly delivered (already-open incident / rate-capped / quiet-hours-held) are
 *  both "not a detected change" — the two-tier discipline's LLM pass should skip them even when
 *  the seam is armed. `payload.delivered === false` is the signal `error-triage.ts` attaches;
 *  everything else is enrichment-eligible by default. */
export function isEnrichable(finding: Finding): boolean {
  if (finding.kind === "rollup") return false;
  if (finding.payload.delivered === false) return false;
  return true;
}

/** Run one watcher to completion: detect → optional LLM enrichment → persist → run ledger.
 *  Never throws — a watcher failure is recorded on the run row and returned in the summary. A
 *  started run always reaches a terminal status: even a throw before the try block below (a
 *  startRun DB failure) falls back to a synthetic id so the rest of this function's own
 *  never-throws guarantee still holds. */
export async function runWatcher(
  watcher: Watcher,
  config: Config,
  store: Store,
  fetchImpl: Fetcher,
  now: () => number = Date.now,
): Promise<RunSummary> {
  let runId: string;
  try {
    runId = await store.startRun(watcher.name);
  } catch (err) {
    runId = crypto.randomUUID();
    logger.error(
      "startRun failed — continuing with a synthetic run id (no ledger row for this run)",
      {
        watcher: watcher.name,
        err: err instanceof Error ? err.message : String(err),
      },
    );
  }

  try {
    const detected = await watcher.run({
      config,
      store,
      fetchImpl,
      now,
      logger,
    });
    const toEnrich = detected.filter(isEnrichable);
    const skipped = detected.filter((f) => !isEnrichable(f));
    const enrichedSubset = await enrichFindings(toEnrich, config, fetchImpl);
    const enriched = [...enrichedSubset, ...skipped];

    // Persist per-finding: one malformed/oversized finding must never drop the rest of the
    // batch (a batch-aborting throw here previously meant an error group later in the same
    // groups[] silently vanished whenever an earlier one tripped parseFinding's strict caps).
    let persisted = 0;
    for (const finding of enriched) {
      try {
        await store.upsertFinding(finding, runId);
        persisted += 1;
      } catch (err) {
        logger.error(
          "upsertFinding failed for one finding — skipping it, continuing the batch",
          {
            watcher: watcher.name,
            dedupKey: finding.dedupKey,
            err: err instanceof Error ? err.message : String(err),
          },
        );
      }
    }

    await safeFinishRun(store, runId, "ok", persisted);
    logger.info("watcher run ok", {
      watcher: watcher.name,
      findings: persisted,
      detected: enriched.length,
    });
    return {
      watcher: watcher.name,
      status: "ok",
      findingsCount: persisted,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await safeFinishRun(store, runId, "error", 0, message.slice(0, 2000));
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

/** `setInterval`/`setTimeout` clamp any delay above the signed-32-bit millisecond ceiling
 *  (2_147_483_647 ms ≈ 24.8 days) to **1 ms** — silently turning a long cadence (soc2's 30-day) into
 *  a tight loop that hammers the upstream (CAISSON-49). `longInterval` re-arms a chained `setTimeout`
 *  in ceiling-bounded chunks so a cadence of ANY length fires at its true interval; for a sub-ceiling
 *  delay it arms exactly once per period, matching `setInterval` semantics — including that `clear()`
 *  called from inside the callback stops it, and a throwing callback does not silently kill the
 *  interval (the next period still re-arms). Timer fns are injectable so the chunking is unit-testable
 *  without real clocks. */
export const MAX_TIMER_DELAY_MS = 2_147_483_647;

export function longInterval(
  cb: () => void,
  delayMs: number,
  setTimeoutImpl: (
    fn: () => void,
    ms: number,
  ) => ReturnType<typeof setTimeout> = setTimeout,
  clearTimeoutImpl: (t: ReturnType<typeof setTimeout>) => void = clearTimeout,
): { clear: () => void } {
  // A non-finite or non-positive delay would busy-loop; clamp to a 1s floor. Config validates
  // cadences upstream, so this is a defensive guard, not a live path.
  const interval = Number.isFinite(delayMs) && delayMs >= 1 ? delayMs : 1_000;
  let timer: ReturnType<typeof setTimeout>;
  let stopped = false;
  const arm = (remaining: number): void => {
    const chunk = Math.min(remaining, MAX_TIMER_DELAY_MS);
    timer = setTimeoutImpl(() => {
      if (stopped) return; // clear() may have fired between arming and this tick
      const left = remaining - chunk;
      if (left > 0) {
        arm(left);
      } else {
        // A throw from cb must not kill the interval (setInterval keeps ticking); the finally
        // re-arms the next period unless the callback itself called clear().
        try {
          cb();
        } finally {
          if (!stopped) arm(interval);
        }
      }
    }, chunk);
  };
  arm(interval);
  return {
    clear(): void {
      stopped = true;
      clearTimeoutImpl(timer);
    },
  };
}

/**
 * Wraps `runWatcher` so a still-in-flight run for a given watcher causes the next call to skip
 * (return `null`) rather than run concurrently — the overlap guard. Exported standalone (not
 * inlined into `startScheduler`) so it's testable without real timers: call it twice without
 * awaiting the first to prove the second skips, then resolve the first and prove a third call
 * proceeds normally.
 */
export function createOverlapGuard(
  config: Config,
  store: Store,
  fetchImpl: Fetcher,
): (watcher: Watcher) => Promise<RunSummary | null> {
  const running = new Set<string>();
  return async (watcher: Watcher): Promise<RunSummary | null> => {
    if (running.has(watcher.name)) return null;
    running.add(watcher.name);
    try {
      return await runWatcher(watcher, config, store, fetchImpl);
    } finally {
      running.delete(watcher.name);
    }
  };
}

/** Start one interval timer per watcher at its configured cadence. Each watcher also fires once
 *  immediately on boot so a fresh deploy doesn't wait a full cadence for its first signal. Every
 *  fire-and-forget call carries a `.catch` — belt-and-suspenders on top of `runWatcher`'s own
 *  never-throws guarantee and `createOverlapGuard`'s try/finally, so a timer callback can never
 *  become an unhandled rejection regardless of what changes upstream. */
export function startScheduler(
  config: Config,
  store: Store,
  fetchImpl: Fetcher,
): SchedulerHandle {
  const guardedRun = createOverlapGuard(config, store, fetchImpl);

  function fire(watcher: Watcher): void {
    guardedRun(watcher)
      .then((result) => {
        if (result === null) {
          logger.warn(
            "watcher tick skipped — the previous run is still in flight",
            { watcher: watcher.name },
          );
        }
      })
      .catch((err: unknown) => {
        logger.error("scheduler tick rejected unexpectedly", {
          watcher: watcher.name,
          err: err instanceof Error ? err.message : String(err),
        });
      });
  }

  const timers = WATCHERS.map((watcher) => {
    fire(watcher);
    // `longInterval`, NOT `setInterval` — a raw setInterval clamps any cadence over ~24.8 days to
    // 1ms and tight-loops (CAISSON-49); soc2's 30-day cadence is exactly such a case.
    return longInterval(() => fire(watcher), watcher.cadenceMs(config));
  });
  return {
    stop(): void {
      for (const t of timers) t.clear();
    },
  };
}
