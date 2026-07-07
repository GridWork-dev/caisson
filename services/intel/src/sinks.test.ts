import { describe, expect, test } from "bun:test";
import {
  buildAlertChannels,
  createLinearTriageChannel,
  createTgBridgeChannel,
} from "./sinks.ts";
import type { Fetcher } from "./http.ts";
import type { Config } from "./config.ts";
import type { AlertEvent } from "@caisson/alerting";

const event: AlertEvent = {
  id: "evt_1",
  type: "system.error_group",
  severity: "critical",
  tenantId: "operator",
  recipient: "operator",
  dedupeKey: "error:fp1:mag1",
  title: "Error: boom",
  body: "12 occurrences",
  createdAt: 1_750_000_000_000,
};

function fakeFetch(status: number, body: unknown = {}): Fetcher {
  return (() =>
    Promise.resolve(
      new Response(JSON.stringify(body), { status }),
    )) as unknown as Fetcher;
}

describe("createTgBridgeChannel", () => {
  test("ok on a 2xx response", async () => {
    const channel = createTgBridgeChannel(
      { url: "https://tg.example.com/alert", token: "tok" },
      fakeFetch(200),
    );
    expect(await channel.deliver(event)).toEqual({
      channel: "tg-bridge",
      ok: true,
    });
  });

  test("fails without leaking the response body", async () => {
    const channel = createTgBridgeChannel(
      { url: "https://tg.example.com/alert", token: "tok" },
      fakeFetch(500, { secret: "leaked-token" }),
    );
    const result = await channel.deliver(event);
    expect(result.ok).toBe(false);
    expect(result.error ?? "").not.toContain("leaked-token");
  });

  test("a network throw is caught into a failed DeliveryResult, never propagates", async () => {
    const channel = createTgBridgeChannel(
      { url: "https://tg.example.com/alert", token: "tok" },
      (() => Promise.reject(new Error("ECONNREFUSED"))) as unknown as Fetcher,
    );
    const result = await channel.deliver(event);
    expect(result).toEqual({
      channel: "tg-bridge",
      ok: false,
      error: "ECONNREFUSED",
    });
  });
});

describe("createLinearTriageChannel", () => {
  test("ok when the GraphQL response reports issueCreate success", async () => {
    const channel = createLinearTriageChannel(
      { apiKey: "lin_api_x", teamId: "team_1" },
      fakeFetch(200, { data: { issueCreate: { success: true } } }),
    );
    expect(await channel.deliver(event)).toEqual({
      channel: "linear",
      ok: true,
    });
  });

  test("fails when GraphQL reports success:false despite HTTP 200", async () => {
    const channel = createLinearTriageChannel(
      { apiKey: "lin_api_x", teamId: "team_1" },
      fakeFetch(200, { data: { issueCreate: { success: false } } }),
    );
    const result = await channel.deliver(event);
    expect(result.ok).toBe(false);
  });

  test("fails when the response carries a top-level errors array", async () => {
    const channel = createLinearTriageChannel(
      { apiKey: "lin_api_x", teamId: "team_1" },
      fakeFetch(200, { errors: [{ message: "bad team id" }] }),
    );
    expect((await channel.deliver(event)).ok).toBe(false);
  });
});

const baseConfig: Config = {
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

describe("buildAlertChannels", () => {
  test("no channels when no sink env is configured", () => {
    expect(buildAlertChannels(baseConfig, fakeFetch(200))).toEqual([]);
  });

  test("only the fully-configured sinks are built", () => {
    const channels = buildAlertChannels(
      {
        ...baseConfig,
        tgBridgeAlertUrl: "https://tg.example.com/alert",
        tgBridgeAlertToken: "t",
      },
      fakeFetch(200),
    );
    expect(channels.map((c) => c.name)).toEqual(["tg-bridge"]);
  });

  test("both sinks build when both are fully configured", () => {
    const channels = buildAlertChannels(
      {
        ...baseConfig,
        tgBridgeAlertUrl: "https://tg.example.com/alert",
        tgBridgeAlertToken: "t",
        linearApiKey: "lin_api_x",
        linearTeamId: "team_1",
      },
      fakeFetch(200),
    );
    expect(channels.map((c) => c.name).sort()).toEqual(["linear", "tg-bridge"]);
  });
});
