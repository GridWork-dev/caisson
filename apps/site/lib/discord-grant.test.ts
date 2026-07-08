// The link-time Discord backfill push (ADR-0203): config gating + payload shape + never-throws.
import { describe, expect, test } from "bun:test";
import type { fetchWithTimeout } from "@caisson/kernel";
import {
  discordInviteUrl,
  loadDiscordGrantConfig,
  pushDiscordGrant,
} from "./discord-grant.ts";

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

describe("discordInviteUrl (G12: undefined until the operator generates one)", () => {
  test("undefined when unset or blank", () => {
    expect(discordInviteUrl({})).toBeUndefined();
    expect(
      discordInviteUrl({ NEXT_PUBLIC_DISCORD_INVITE_URL: "  " }),
    ).toBeUndefined();
  });

  test("undefined on a non-https URL — never rendered as an unvalidated href", () => {
    expect(
      discordInviteUrl({
        NEXT_PUBLIC_DISCORD_INVITE_URL: "http://discord.gg/abc123",
      }),
    ).toBeUndefined();
    expect(
      discordInviteUrl({
        NEXT_PUBLIC_DISCORD_INVITE_URL: "javascript:alert(1)",
      }),
    ).toBeUndefined();
  });

  test("undefined on an unparseable value", () => {
    expect(
      discordInviteUrl({ NEXT_PUBLIC_DISCORD_INVITE_URL: "not a url" }),
    ).toBeUndefined();
  });

  test("returns a well-formed https invite URL verbatim", () => {
    expect(
      discordInviteUrl({
        NEXT_PUBLIC_DISCORD_INVITE_URL: "https://discord.gg/abc123",
      }),
    ).toBe("https://discord.gg/abc123");
  });
});
