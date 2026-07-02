// The link-time Discord backfill push (ADR-0201): config gating + payload shape + never-throws.
import { describe, expect, test } from "bun:test";
import type { fetchWithTimeout } from "@caisson/kernel";
import { loadDiscordGrantConfig, pushDiscordGrant } from "./discord-grant.ts";

type FetchImpl = typeof fetchWithTimeout;

describe("loadDiscordGrantConfig (env-gated, same pair as services/license)", () => {
  test("null unless BOTH url + token set; trailing slash normalized", () => {
    expect(loadDiscordGrantConfig({})).toBeNull();
    expect(
      loadDiscordGrantConfig({ SUPPORT_BOT_URL: "https://bot.test" }),
    ).toBeNull();
    expect(loadDiscordGrantConfig({ SUPPORT_BOT_GRANT_TOKEN: "t" })).toBeNull();
    expect(
      loadDiscordGrantConfig({
        SUPPORT_BOT_URL: "https://bot.test/",
        SUPPORT_BOT_GRANT_TOKEN: "t",
      }),
    ).toEqual({ url: "https://bot.test", token: "t" });
  });
});

describe("pushDiscordGrant", () => {
  const config = { url: "https://bot.test", token: "tok" };

  test("POSTs the Bearer + verbatim entitlements to /billing-grant", async () => {
    const calls: Array<{ url: string; auth: string; body: unknown }> = [];
    const fake: FetchImpl = async (input, init) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        auth: headers.get("authorization") ?? "",
        body: JSON.parse(String(init?.body)),
      });
      return new Response("{}", { status: 200 });
    };
    const ok = await pushDiscordGrant(config, "111", ["bundle"], fake);
    expect(ok).toBe(true);
    expect(calls).toEqual([
      {
        url: "https://bot.test/billing-grant",
        auth: "Bearer tok",
        body: { discord_user_id: "111", entitlements: ["bundle"] },
      },
    ]);
  });

  test("a non-2xx bot response returns false, never throws", async () => {
    const fake: FetchImpl = async () => new Response("{}", { status: 502 });
    expect(await pushDiscordGrant(config, "111", ["compliance"], fake)).toBe(
      false,
    );
  });

  test("a throwing fetch returns false, never throws", async () => {
    const fake: FetchImpl = async () => {
      throw new Error("network down");
    };
    expect(await pushDiscordGrant(config, "111", ["compliance"], fake)).toBe(
      false,
    );
  });
});
