// G21: the Ask-AI escalation ticket push — config gating + payload shape + never-throws.
import { describe, expect, test } from "bun:test";
import type { fetchWithTimeout } from "@caisson/kernel";
import { loadSiteEscalateConfig, pushSiteEscalation } from "./site-escalate.ts";

type FetchImpl = typeof fetchWithTimeout;

describe("loadSiteEscalateConfig (env-gated pair, mirrors discord-grant.ts)", () => {
  test("null unless BOTH url + token set; trailing slash normalized", () => {
    expect(loadSiteEscalateConfig({})).toBeNull();
    expect(
      loadSiteEscalateConfig({ SUPPORT_BOT_URL: "https://bot.test" }),
    ).toBeNull();
    expect(
      loadSiteEscalateConfig({ SUPPORT_BOT_ESCALATE_TOKEN: "t" }),
    ).toBeNull();
    expect(
      loadSiteEscalateConfig({
        SUPPORT_BOT_URL: "https://bot.test/",
        SUPPORT_BOT_ESCALATE_TOKEN: "t",
      }),
    ).toEqual({ url: "https://bot.test", token: "t" });
  });
});

describe("pushSiteEscalation", () => {
  const config = { url: "https://bot.test", token: "tok" };

  test("POSTs the Bearer + question + reason to /escalate", async () => {
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
    const ok = await pushSiteEscalation(
      config,
      "does compliance do HIPAA?",
      "no_match",
      fake,
    );
    expect(ok).toBe(true);
    expect(calls).toEqual([
      {
        url: "https://bot.test/escalate",
        auth: "Bearer tok",
        body: { question: "does compliance do HIPAA?", reason: "no_match" },
      },
    ]);
  });

  test("a non-2xx bot response returns false, never throws", async () => {
    const fake: FetchImpl = async () => new Response("{}", { status: 502 });
    expect(await pushSiteEscalation(config, "q", "no_match", fake)).toBe(false);
  });

  test("a throwing fetch returns false, never throws", async () => {
    const fake: FetchImpl = async () => {
      throw new Error("network down");
    };
    expect(await pushSiteEscalation(config, "q", "no_match", fake)).toBe(false);
  });
});
