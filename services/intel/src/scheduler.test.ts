import { describe, expect, test } from "bun:test";
import { runWatcher } from "./scheduler.ts";
import { InMemoryStore } from "./store.ts";
import type { Fetcher } from "./http.ts";
import type { Config } from "./config.ts";
import type { Finding } from "./finding.ts";
import type { Watcher } from "./watchers/types.ts";

const config: Config = {
  databaseUrl: "postgres://x",
  healthzPort: 8791,
  healthzHost: "0.0.0.0",
  schedulerEnabled: false,
  cadenceComplianceMs: 1,
  cadenceSoc2Ms: 1,
  cadenceCompetitorMs: 1,
  cadenceGithubMs: 1,
  cadenceAnalyticsMs: 1,
  cadenceErrorMs: 1,
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
});
