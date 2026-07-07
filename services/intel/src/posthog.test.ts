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

  test("drops resolved/suppressed/muted issues — only active (or status-absent) issues survive", () => {
    const raw = {
      results: [
        { id: "fp1", name: "Active one", occurrences: 5, status: "active" },
        { id: "fp2", name: "No status field", occurrences: 3 },
        { id: "fp3", name: "Resolved", occurrences: 99, status: "resolved" },
        {
          id: "fp4",
          name: "Suppressed",
          occurrences: 99,
          status: "suppressed",
        },
      ],
    };
    expect(parseErrorGroups(raw).map((g) => g.fingerprint)).toEqual([
      "fp1",
      "fp2",
    ]);
  });

  test("an unbounded name is capped at the parse boundary, not left to trip a downstream length cap", () => {
    const raw = {
      results: [{ id: "fp1", name: "x".repeat(10_000), occurrences: 1 }],
    };
    const [group] = parseErrorGroups(raw);
    expect(group?.name.length).toBeLessThanOrEqual(500);
  });
});

const configWithKey: Config = {
  databaseUrl: "postgres://x",
  healthzPort: 8791,
  healthzHost: "0.0.0.0",
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

  test("errorGroups() attaches a navigable PostHog dashboard URL per group (the API response itself carries no link)", async () => {
    const fakeFetch = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            results: [{ id: "fp1", name: "Boom", occurrences: 5 }],
          }),
          { status: 200 },
        ),
      )) as unknown as Parameters<typeof createPostHogClient>[1];
    const client = createPostHogClient(
      { ...configWithKey, posthogApiKey: "phx_test" },
      fakeFetch,
    );
    const groups = await client?.errorGroups();
    expect(groups?.[0]?.url).toBe(
      "https://us.posthog.com/project/493539/error_tracking/fp1",
    );
  });
});
