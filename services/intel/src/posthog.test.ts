import { describe, expect, test } from "bun:test";
import {
  createPostHogClient,
  parseErrorGroups,
  parseRollup,
} from "./posthog.ts";
import type { Config } from "./config.ts";

describe("parseRollup", () => {
  test("maps the first results row to events/users", () => {
    expect(parseRollup({ results: [[12, 4]] })).toEqual({
      events: 12,
      users: 4,
    });
  });

  test("non-numeric cells default to 0", () => {
    expect(parseRollup({ results: [["nope", null]] })).toEqual({
      events: 0,
      users: 0,
    });
  });
});

describe("parseErrorGroups", () => {
  test("maps issues, preferring occurrences over volume over count", () => {
    const raw = {
      results: [
        { id: "fp1", name: "TypeError: x", occurrences: 12 },
        { id: "fp2", name: "Timeout", volume: 5 },
        { id: "fp3", name: "Unknown" },
      ],
    };
    expect(parseErrorGroups(raw)).toEqual([
      { fingerprint: "fp1", name: "TypeError: x", occurrences: 12 },
      { fingerprint: "fp2", name: "Timeout", occurrences: 5 },
      { fingerprint: "fp3", name: "Unknown", occurrences: 1 },
    ]);
  });

  test("returns [] on an unexpected shape", () => {
    expect(parseErrorGroups(null)).toEqual([]);
  });
});

const configWithKey: Config = {
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

describe("createPostHogClient", () => {
  test("returns null when POSTHOG_API_KEY is unset (the leg self-skips)", () => {
    expect(
      createPostHogClient(configWithKey, (() => {
        throw new Error("must not fetch");
      }) as never),
    ).toBeNull();
  });

  test("builds a client when the key is present", () => {
    const client = createPostHogClient(
      { ...configWithKey, posthogApiKey: "phx_test" },
      (() => {
        throw new Error("not called in this test");
      }) as never,
    );
    expect(client).not.toBeNull();
  });
});
