import { describe, expect, test } from "bun:test";
import { detectSoc2Change, soc2Watcher } from "./soc2.ts";
import { logger } from "../logger.ts";
import { InMemoryStore } from "../store.ts";
import type { Config } from "../config.ts";
import type { Fetcher } from "../http.ts";
import type { WatcherCtx } from "./types.ts";

describe("detectSoc2Change", () => {
  test("first observation records a baseline, no finding", () => {
    const { findings, nextState } = detectSoc2Change("page content", {});
    expect(findings).toEqual([]);
    expect(nextState["soc2:aicpa:hash"]).toBeDefined();
  });

  test("a hash mismatch against stored state emits a finding", () => {
    const { findings } = detectSoc2Change("new content", {
      "soc2:aicpa:hash": "deadbeef",
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.source).toBe("soc2");
  });

  test("a first observation stores a snapshot alongside the hash", () => {
    const { nextState } = detectSoc2Change("SOC 2 resources page v1", {});
    expect(nextState["soc2:aicpa:snapshot"]).toBe("SOC 2 resources page v1");
  });

  test("a change with a stored snapshot carries a before/after content delta", () => {
    const head = "SOC 2 Type II report guidance updated ";
    const { findings, nextState } = detectSoc2Change(`${head}March 2026`, {
      "soc2:aicpa:hash": "deadbeef",
      "soc2:aicpa:snapshot": `${head}March 2025`,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.payload["previousExcerpt"]).toContain("March 2025");
    expect(findings[0]?.payload["currentExcerpt"]).toContain("March 2026");
    expect(nextState["soc2:aicpa:snapshot"]).toBe(`${head}March 2026`);
  });

  test("an unchanged hash emits nothing", () => {
    const baseline = detectSoc2Change("stable content", {}).nextState;
    const { findings } = detectSoc2Change("stable content", baseline);
    expect(findings).toEqual([]);
  });

  test("an empty body is no signal — it neither emits nor overwrites a stored baseline", () => {
    const { findings, nextState } = detectSoc2Change("", {
      "soc2:aicpa:hash": "deadbeef",
    });
    expect(findings).toEqual([]);
    expect(nextState).toEqual({});
  });
});

const BASE_CONFIG: Config = {
  databaseUrl: "postgres://x",
  healthzPort: 8791,
  healthzHost: "127.0.0.1",
  schedulerEnabled: false,
  migrateOnBoot: false,
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

describe("soc2Watcher.run (the run()-level wiring, not just the pure detect function)", () => {
  test("an empty 200 body leaves watch_state untouched (the pre-existing baseline, if any, survives)", async () => {
    const store = new InMemoryStore();
    await store.setWatchState({ "soc2:aicpa:hash": "existing-baseline" });
    const emptyFetch: Fetcher = (() =>
      Promise.resolve(new Response("", { status: 200 }))) as unknown as Fetcher;
    const ctx: WatcherCtx = {
      config: BASE_CONFIG,
      store,
      fetchImpl: emptyFetch,
      now: () => 1_000,
      logger,
    };
    const findings = await soc2Watcher.run(ctx);
    expect(findings).toEqual([]);
    expect(await store.getWatchState(["soc2:aicpa:hash"])).toEqual({
      "soc2:aicpa:hash": "existing-baseline",
    });
  });

  test("a fetch throw returns no findings and never touches watch_state", async () => {
    const store = new InMemoryStore();
    const throwingFetch: Fetcher = (() =>
      Promise.reject(new Error("network down"))) as unknown as Fetcher;
    const ctx: WatcherCtx = {
      config: BASE_CONFIG,
      store,
      fetchImpl: throwingFetch,
      now: () => 1_000,
      logger,
    };
    const findings = await soc2Watcher.run(ctx);
    expect(findings).toEqual([]);
    expect(await store.getWatchState(["soc2:aicpa:hash"])).toEqual({});
  });
});
