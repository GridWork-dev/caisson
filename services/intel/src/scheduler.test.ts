import { describe, expect, test } from "bun:test";
import {
  createOverlapGuard,
  isEnrichable,
  longInterval,
  MAX_TIMER_DELAY_MS,
  runWatcher,
} from "./scheduler.ts";
import { InMemoryStore } from "./store.ts";
import type { Store } from "./store.ts";
import type { Fetcher } from "./http.ts";
import type { Config } from "./config.ts";
import type { Finding } from "./finding.ts";
import type { Watcher } from "./watchers/types.ts";

const config: Config = {
  databaseUrl: "postgres://x",
  healthzPort: 8791,
  healthzHost: "0.0.0.0",
  schedulerEnabled: false,
  migrateOnBoot: false,
  cadenceComplianceMs: 1_000,
  cadenceSoc2Ms: 1_000,
  cadenceCompetitorMs: 1_000,
  cadenceGithubMs: 1_000,
  cadenceAnalyticsMs: 1_000,
  cadenceErrorMs: 1_000,
  competitorUrls: [],
  githubOrg: "caisson-sh",
  posthogApiHost: "https://us.posthog.com",
  posthogProjectId: "493539",
  plausibleApiHost: "https://plausible.io",
  alertRateMaxPerWindow: 3,
  alertTz: "UTC",
  alertQuietStart: 0,
  alertQuietEnd: 0,
  llmEnabled: false,
  llmModel: "anthropic/claude-3.5-haiku",
};

const finding: Finding = {
  source: "github",
  kind: "traction",
  severity: "info",
  title: "test finding",
  body: "detail",
  dedupKey: "github:test:1",
  payload: {},
};

const noopFetch = (() =>
  Promise.resolve(new Response("{}"))) as unknown as Fetcher;

describe("runWatcher", () => {
  test("persists detected findings and records an ok run", async () => {
    const watcher: Watcher = {
      name: "fake",
      cadenceMs: () => 1,
      run: () => Promise.resolve([finding]),
    };
    const store = new InMemoryStore();
    const summary = await runWatcher(watcher, config, store, noopFetch);
    expect(summary).toEqual({
      watcher: "fake",
      status: "ok",
      findingsCount: 1,
    });
    expect(await store.getWatchState(["never-set"])).toEqual({});
  });

  test("a watcher throw is recorded as an error run, never propagates", async () => {
    const watcher: Watcher = {
      name: "flaky",
      cadenceMs: () => 1,
      run: () => Promise.reject(new Error("upstream down")),
    };
    const store = new InMemoryStore();
    const summary = await runWatcher(watcher, config, store, noopFetch);
    expect(summary.status).toBe("error");
    expect(summary.error).toBe("upstream down");
    expect(summary.findingsCount).toBe(0);
  });

  test("zero findings is a valid ok run", async () => {
    const watcher: Watcher = {
      name: "quiet",
      cadenceMs: () => 1,
      run: () => Promise.resolve([]),
    };
    const store = new InMemoryStore();
    const summary = await runWatcher(watcher, config, store, noopFetch);
    expect(summary).toEqual({
      watcher: "quiet",
      status: "ok",
      findingsCount: 0,
    });
  });

  test("one bad finding in a batch is skipped, not fatal to the rest — a store failure on a single upsert doesn't abort the run", async () => {
    const good1: Finding = { ...finding, dedupKey: "github:good:1" };
    const bad: Finding = { ...finding, dedupKey: "github:bad:1" };
    const good2: Finding = { ...finding, dedupKey: "github:good:2" };
    const watcher: Watcher = {
      name: "batch",
      cadenceMs: () => 1,
      run: () => Promise.resolve([good1, bad, good2]),
    };
    class FlakyStore extends InMemoryStore {
      override upsertFinding(
        f: Finding,
        runId: string,
      ): ReturnType<InMemoryStore["upsertFinding"]> {
        if (f.dedupKey === "github:bad:1") {
          return Promise.reject(new Error("constraint violation"));
        }
        return super.upsertFinding(f, runId);
      }
    }
    const store = new FlakyStore();
    const summary = await runWatcher(watcher, config, store, noopFetch);
    // 2 of 3 persisted; the run is still "ok" — one bad finding is not a run-level failure.
    expect(summary).toEqual({
      watcher: "batch",
      status: "ok",
      findingsCount: 2,
    });
  });

  test("never rejects even when the store's startRun AND finishRun both fail", async () => {
    class DoublyFlakyStore extends InMemoryStore {
      override startRun(): Promise<string> {
        return Promise.reject(new Error("db unreachable"));
      }
      override finishRun(): Promise<void> {
        return Promise.reject(new Error("db unreachable"));
      }
    }
    const watcher: Watcher = {
      name: "resilient",
      cadenceMs: () => 1,
      run: () => Promise.resolve([finding]),
    };
    const store = new DoublyFlakyStore();
    // The assertion IS that this resolves at all — a pre-fix runWatcher would reject here.
    const summary = await runWatcher(watcher, config, store, noopFetch);
    expect(summary.status).toBe("ok");
    expect(summary.findingsCount).toBe(1);
  });

  test("a watcher throw still reaches a terminal status even when finishRun itself fails", async () => {
    class FinishFailsStore extends InMemoryStore {
      override finishRun(): Promise<void> {
        return Promise.reject(new Error("db unreachable"));
      }
    }
    const watcher: Watcher = {
      name: "double-fail",
      cadenceMs: () => 1,
      run: () => Promise.reject(new Error("upstream down")),
    };
    const store = new FinishFailsStore();
    const summary = await runWatcher(watcher, config, store, noopFetch);
    expect(summary.status).toBe("error");
    expect(summary.error).toBe("upstream down");
  });
});

describe("longInterval (CAISSON-49 — no 32-bit clamp)", () => {
  const SOC2_30_DAY_MS = 30 * 24 * 60 * 60 * 1_000; // 2_592_000_000 — over the 32-bit ceiling

  test("a delay over the 32-bit ceiling is chunked to the ceiling, never clamped to 1ms", () => {
    const armed: number[] = [];
    const fakeSetTimeout = (_fn: () => void, ms: number) => {
      armed.push(ms);
      return 0 as unknown as ReturnType<typeof setTimeout>;
    };
    // A raw setInterval(SOC2_30_DAY_MS) clamps to 1ms and tight-loops. longInterval arms the first
    // chunk at the ceiling instead — the exact regression CAISSON-49 fixes.
    const h = longInterval(
      () => {},
      SOC2_30_DAY_MS,
      fakeSetTimeout,
      () => {},
    );
    expect(armed[0]).toBe(MAX_TIMER_DELAY_MS);
    expect(armed[0]).toBeGreaterThan(1);
    h.clear();
  });

  test("the remainder is armed after the first ceiling chunk fires (full period preserved)", () => {
    const fns: Array<() => void> = [];
    const armed: number[] = [];
    const fakeSetTimeout = (fn: () => void, ms: number) => {
      fns.push(fn);
      armed.push(ms);
      return 0 as unknown as ReturnType<typeof setTimeout>;
    };
    longInterval(
      () => {},
      SOC2_30_DAY_MS,
      fakeSetTimeout,
      () => {},
    );
    expect(armed[0]).toBe(MAX_TIMER_DELAY_MS);
    fns[0]?.(); // fire the ceiling chunk
    expect(armed[1]).toBe(SOC2_30_DAY_MS - MAX_TIMER_DELAY_MS);
    expect(armed[1]).toBeGreaterThan(0);
  });

  test("a normal sub-ceiling delay is armed once, as-is (identical to setInterval)", () => {
    const armed: number[] = [];
    const fakeSetTimeout = (_fn: () => void, ms: number) => {
      armed.push(ms);
      return 0 as unknown as ReturnType<typeof setTimeout>;
    };
    const h = longInterval(
      () => {},
      1_000,
      fakeSetTimeout,
      () => {},
    );
    expect(armed).toEqual([1_000]);
    h.clear();
  });

  test("cb fires and the full interval re-arms once a sub-ceiling period elapses", () => {
    let fired = 0;
    const fns: Array<() => void> = [];
    const armed: number[] = [];
    const fakeSetTimeout = (fn: () => void, ms: number) => {
      fns.push(fn);
      armed.push(ms);
      return 0 as unknown as ReturnType<typeof setTimeout>;
    };
    longInterval(
      () => (fired += 1),
      5_000,
      fakeSetTimeout,
      () => {},
    );
    fns[0]?.(); // the period elapses
    expect(fired).toBe(1);
    expect(armed[1]).toBe(5_000); // re-armed for the next period
  });

  test("clear() cancels the pending timer", () => {
    let cleared = 0;
    const h = longInterval(
      () => {},
      1_000,
      () => 7 as unknown as ReturnType<typeof setTimeout>,
      () => (cleared += 1),
    );
    h.clear();
    expect(cleared).toBe(1);
  });
});

describe("isEnrichable", () => {
  const base: Finding = {
    source: "compliance",
    kind: "framework_release",
    severity: "info",
    title: "t",
    body: "b",
    dedupKey: "k",
    payload: {},
  };

  test("a rollup finding is never enrichable — it's a periodic report, not a detected change", () => {
    expect(isEnrichable({ ...base, kind: "rollup" })).toBe(false);
  });

  test("an error finding marked payload.delivered:false (re-observed, not freshly alerted) is not enrichable", () => {
    expect(
      isEnrichable({
        ...base,
        kind: "error_group",
        payload: { delivered: false },
      }),
    ).toBe(false);
  });

  test("an error finding marked payload.delivered:true IS enrichable", () => {
    expect(
      isEnrichable({
        ...base,
        kind: "error_group",
        payload: { delivered: true },
      }),
    ).toBe(true);
  });

  test("any other finding (no delivered marker) defaults to enrichable", () => {
    expect(isEnrichable({ ...base, kind: "framework_release" })).toBe(true);
  });
});

describe("createOverlapGuard", () => {
  test("a second call for the same watcher while the first is still in flight is skipped (null)", async () => {
    let resolveRun: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      resolveRun = resolve;
    });
    const watcher: Watcher = {
      name: "slow",
      cadenceMs: () => 1,
      run: async () => {
        await gate;
        return [];
      },
    };
    const store: Store = new InMemoryStore();
    const guardedRun = createOverlapGuard(config, store, noopFetch);

    const first = guardedRun(watcher); // still in flight
    const second = await guardedRun(watcher); // must skip immediately
    expect(second).toBeNull();

    resolveRun?.();
    const firstResult = await first;
    expect(firstResult?.status).toBe("ok");

    // Once the first has resolved, a new call is allowed again — the guard isn't stuck.
    const third = await guardedRun(watcher);
    expect(third?.status).toBe("ok");
  });

  test("two DIFFERENT watchers never block each other", async () => {
    let resolveA: (() => void) | undefined;
    const gateA = new Promise<void>((resolve) => {
      resolveA = resolve;
    });
    const watcherA: Watcher = {
      name: "a",
      cadenceMs: () => 1,
      run: async () => {
        await gateA;
        return [];
      },
    };
    const watcherB: Watcher = {
      name: "b",
      cadenceMs: () => 1,
      run: () => Promise.resolve([]),
    };
    const store: Store = new InMemoryStore();
    const guardedRun = createOverlapGuard(config, store, noopFetch);

    const pendingA = guardedRun(watcherA);
    const resultB = await guardedRun(watcherB);
    expect(resultB?.status).toBe("ok");

    resolveA?.();
    expect((await pendingA)?.status).toBe("ok");
  });

  test("a throwing watcher still releases the guard (the finally clears it even on error)", async () => {
    const watcher: Watcher = {
      name: "flaky",
      cadenceMs: () => 1,
      run: () => Promise.reject(new Error("boom")),
    };
    const store: Store = new InMemoryStore();
    const guardedRun = createOverlapGuard(config, store, noopFetch);

    const first = await guardedRun(watcher);
    expect(first?.status).toBe("error"); // runWatcher itself never throws, per its own contract
    const second = await guardedRun(watcher);
    expect(second?.status).toBe("error"); // not stuck skipped after the first "run" completed
  });
});
