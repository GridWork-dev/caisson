import { describe, expect, test } from "bun:test";
import {
  classifyEvent,
  handleRequest,
  secretsMatch,
  toDiscordEmbed,
} from "./handler.ts";
import type { Env, Fetcher, IncidentWebhookBody } from "./handler.ts";

// The confirmed default `incident_change` webhook body (Better Stack docs, see handler.ts's
// module doc for the source URLs) — the `on_incident_comment` worked example, minus the
// comment-specific `event`/`comment` fields for the base incident-triggered case.
const INCIDENT_BODY = {
  event: "created",
  data: {
    id: "1",
    type: "incident",
    attributes: {
      name: "Tesla.com homepage",
      url: "https://tesla.com",
      http_method: "get",
      cause: "Error 500",
      started_at: "2020-10-21T10:51:28.151Z",
      acknowledged_at: null,
      resolved_at: null,
      response_content: null,
      response_url: null,
      screenshot_url: null,
      // A field this adapter does NOT read — proves the inner schema isn't `.strict()`.
      team_name: "Ops",
    },
    relationships: {
      monitor: { data: { id: "4", type: "monitor" } },
    },
  },
};

function fakeFetch(status: number): {
  fetcher: Fetcher;
  calls: Array<{ url: string; body: string }>;
} {
  const calls: Array<{ url: string; body: string }> = [];
  const fetcher = ((url: string, init?: RequestInit) => {
    calls.push({ url: String(url), body: String(init?.body ?? "") });
    return Promise.resolve(new Response("{}", { status }));
  }) as unknown as Fetcher;
  return { fetcher, calls };
}

function postRequest(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request("https://adapter.example.com/", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("classifyEvent", () => {
  test("resolved → RESOLVED (green)", () => {
    expect(classifyEvent("resolved")).toEqual({
      label: "RESOLVED",
      color: 0x2ecc71,
    });
  });

  test("comment → COMMENT (blue, informational)", () => {
    expect(classifyEvent("comment").label).toBe("COMMENT");
  });

  test("acknowledged → ACKNOWLEDGED (blue, informational)", () => {
    expect(classifyEvent("acknowledged").label).toBe("ACKNOWLEDGED");
  });

  test("created/reopened/unknown → TRIGGERED (red) — the safe default", () => {
    expect(classifyEvent("created").label).toBe("TRIGGERED");
    expect(classifyEvent("reopened").label).toBe("TRIGGERED");
    expect(classifyEvent(undefined).label).toBe("TRIGGERED");
    expect(classifyEvent("something-unfamiliar").label).toBe("TRIGGERED");
  });
});

describe("toDiscordEmbed", () => {
  test("maps name/url/cause into a Discord embed with the classified color", () => {
    const parsed = INCIDENT_BODY as unknown as IncidentWebhookBody;
    const embed = toDiscordEmbed(parsed) as {
      embeds: Array<{ title: string; color: number; fields: unknown[] }>;
    };
    expect(embed.embeds).toHaveLength(1);
    expect(embed.embeds[0]?.title).toBe("[TRIGGERED] Tesla.com homepage");
    expect(embed.embeds[0]?.color).toBe(0xe74c3c);
    expect(embed.embeds[0]?.fields).toEqual([
      { name: "Monitor", value: "https://tesla.com", inline: true },
      { name: "Cause", value: "Error 500", inline: true },
    ]);
  });
});

describe("secretsMatch", () => {
  test("equal values match", () => {
    expect(secretsMatch("s3cr3t", "s3cr3t")).toBe(true);
  });

  test("different values don't match", () => {
    expect(secretsMatch("s3cr3t", "wrong")).toBe(false);
  });

  test("different-length values don't throw and don't match", () => {
    expect(secretsMatch("short", "a-much-longer-value")).toBe(false);
  });
});

describe("handleRequest", () => {
  const okEnv: Env = {
    DISCORD_OPS_WEBHOOK_URL: "https://discord.com/api/webhooks/1/abc",
  };

  test("rejects a non-POST method", async () => {
    const { fetcher } = fakeFetch(200);
    const res = await handleRequest(
      new Request("https://adapter.example.com/", { method: "GET" }),
      okEnv,
      fetcher,
    );
    expect(res.status).toBe(405);
  });

  test("rejects invalid JSON", async () => {
    const { fetcher } = fakeFetch(200);
    const req = new Request("https://adapter.example.com/", {
      method: "POST",
      body: "not json",
    });
    const res = await handleRequest(req, okEnv, fetcher);
    expect(res.status).toBe(400);
  });

  test("rejects a payload that doesn't match the expected shape", async () => {
    const { fetcher } = fakeFetch(200);
    const res = await handleRequest(
      postRequest({ hello: "world" }),
      okEnv,
      fetcher,
    );
    expect(res.status).toBe(400);
  });

  test("an unrecognized field inside attributes is ignored, not rejected (non-.strict())", async () => {
    const { fetcher, calls } = fakeFetch(200);
    const res = await handleRequest(postRequest(INCIDENT_BODY), okEnv, fetcher);
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  test("500 when DISCORD_OPS_WEBHOOK_URL is not configured — no delivery attempted", async () => {
    const { fetcher, calls } = fakeFetch(200);
    const res = await handleRequest(postRequest(INCIDENT_BODY), {}, fetcher);
    expect(res.status).toBe(500);
    expect(calls).toHaveLength(0);
  });

  test("502 when the Discord POST fails (non-2xx)", async () => {
    const { fetcher } = fakeFetch(500);
    const res = await handleRequest(postRequest(INCIDENT_BODY), okEnv, fetcher);
    expect(res.status).toBe(502);
  });

  test("502 when the Discord POST throws — never propagates", async () => {
    const throwingFetch = (() =>
      Promise.reject(new Error("ECONNREFUSED"))) as unknown as Fetcher;
    const res = await handleRequest(
      postRequest(INCIDENT_BODY),
      okEnv,
      throwingFetch,
    );
    expect(res.status).toBe(502);
  });

  test("posts the reshaped embed body to the configured Discord webhook", async () => {
    const { fetcher, calls } = fakeFetch(200);
    const res = await handleRequest(postRequest(INCIDENT_BODY), okEnv, fetcher);
    expect(res.status).toBe(200);
    expect(calls[0]?.url).toBe(okEnv.DISCORD_OPS_WEBHOOK_URL);
    const body = JSON.parse(calls[0]?.body ?? "{}") as {
      embeds: Array<{ title: string }>;
    };
    expect(body.embeds[0]?.title).toBe("[TRIGGERED] Tesla.com homepage");
  });

  describe("BETTERSTACK_WEBHOOK_SECRET gating", () => {
    const secretEnv: Env = {
      ...okEnv,
      BETTERSTACK_WEBHOOK_SECRET: "shh-its-a-secret",
    };

    test("no secret configured — no header required", async () => {
      const { fetcher } = fakeFetch(200);
      const res = await handleRequest(
        postRequest(INCIDENT_BODY),
        okEnv,
        fetcher,
      );
      expect(res.status).toBe(200);
    });

    test("secret configured, header missing → 401, no delivery attempted", async () => {
      const { fetcher, calls } = fakeFetch(200);
      const res = await handleRequest(
        postRequest(INCIDENT_BODY),
        secretEnv,
        fetcher,
      );
      expect(res.status).toBe(401);
      expect(calls).toHaveLength(0);
    });

    test("secret configured, header wrong → 401", async () => {
      const { fetcher } = fakeFetch(200);
      const res = await handleRequest(
        postRequest(INCIDENT_BODY, { "x-betterstack-secret": "nope" }),
        secretEnv,
        fetcher,
      );
      expect(res.status).toBe(401);
    });

    test("secret configured, header matches → 200, delivered", async () => {
      const { fetcher, calls } = fakeFetch(200);
      const res = await handleRequest(
        postRequest(INCIDENT_BODY, {
          "x-betterstack-secret": "shh-its-a-secret",
        }),
        secretEnv,
        fetcher,
      );
      expect(res.status).toBe(200);
      expect(calls).toHaveLength(1);
    });
  });
});
