import { describe, expect, test } from "bun:test";
import {
  competitorStateKeys,
  competitorWatcher,
  detectCompetitorChanges,
} from "./competitor.ts";
import { logger } from "../logger.ts";
import { InMemoryStore } from "../store.ts";
import type { Config } from "../config.ts";
import type { Fetcher } from "../http.ts";
import type { WatcherCtx } from "./types.ts";

const URL = "https://competitor.example.com/pricing";

describe("detectCompetitorChanges", () => {
  test("first observation records a baseline, no finding", () => {
    const { findings, nextState } = detectCompetitorChanges(
      [{ url: URL, text: "v1" }],
      {},
    );
    expect(findings).toEqual([]);
    expect(Object.keys(nextState)).toHaveLength(1);
  });

  test("a content change against stored state emits a page_diff finding", () => {
    const baseline = detectCompetitorChanges(
      [{ url: URL, text: "v1" }],
      {},
    ).nextState;
    const { findings } = detectCompetitorChanges(
      [{ url: URL, text: "v2" }],
      baseline,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("page_diff");
    expect(findings[0]?.title).toContain("competitor.example.com");
  });

  test("no content change emits nothing", () => {
    const baseline = detectCompetitorChanges(
      [{ url: URL, text: "stable" }],
      {},
    ).nextState;
    const { findings } = detectCompetitorChanges(
      [{ url: URL, text: "stable" }],
      baseline,
    );
    expect(findings).toEqual([]);
  });

  test("an empty page body is no signal — it neither emits nor overwrites a stored baseline", () => {
    const baseline = detectCompetitorChanges(
      [{ url: URL, text: "v1" }],
      {},
    ).nextState;
    const { findings, nextState } = detectCompetitorChanges(
      [{ url: URL, text: "" }],
      baseline,
    );
    expect(findings).toEqual([]);
    expect(nextState).toEqual({});
  });
});

describe("competitorStateKeys", () => {
  test("produces one key per URL", () => {
    expect(
      competitorStateKeys([URL, "https://other.example.com"]),
    ).toHaveLength(2);
  });
});

const OTHER_URL = "https://other.example.com/changelog";

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
  cadenceDepDigestMs: 1,
  competitorUrls: [URL, OTHER_URL],
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

describe("competitorWatcher.run (the run()-level wiring, not just the pure detect function)", () => {
  test("a fetch throw for ONE url leaves that url's watch_state key untouched; the other still records a baseline", async () => {
    const store = new InMemoryStore();
    // `input: string | Request` — NOT `| URL`: the module-level `const URL` (a string constant,
    // the competitor page URL under test) shadows the global `URL` constructor's TYPE for this
    // whole file, so referencing `URL` in a type position here would resolve to the wrong thing.
    const partialFetch: Fetcher = ((input: string | Request) => {
      const url = typeof input === "string" ? input : input.url;
      if (url === URL) return Promise.reject(new Error("network down"));
      return Promise.resolve(new Response("stable content", { status: 200 }));
    }) as unknown as Fetcher;
    const ctx: WatcherCtx = {
      config: BASE_CONFIG,
      store,
      fetchImpl: partialFetch,
      now: () => 1_000,
      logger,
    };
    await competitorWatcher.run(ctx);
    const state = await store.getWatchState(
      competitorStateKeys([URL, OTHER_URL]),
    );
    const [failedKey, okKey] = competitorStateKeys([URL, OTHER_URL]);
    expect(state[failedKey ?? ""]).toBeUndefined();
    expect(state[okKey ?? ""]).toBeDefined();
  });
});
