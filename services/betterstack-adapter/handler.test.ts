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

  test("truncates title/field values to Discord's hard caps (schema allows more than Discord accepts)", () => {
    const overCap = {
      ...INCIDENT_BODY,
      data: {
        ...INCIDENT_BODY.data,
        attributes: {
          ...INCIDENT_BODY.data.attributes,
          name: "n".repeat(500), // schema max
          url: "https://example.com/" + "u".repeat(2000), // schema max
          cause: "c".repeat(2000), // schema max
        },
      },
    } as unknown as IncidentWebhookBody;

    const embed = toDiscordEmbed(overCap) as {
      embeds: Array<{
        title: string;
        fields: Array<{ name: string; value: string }>;
      }>;
    };

    expect(embed.embeds[0]?.title.length).toBeLessThanOrEqual(256);
    for (const field of embed.embeds[0]?.fields ?? []) {
      expect(field.value.length).toBeLessThanOrEqual(1024);
    }
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
  // BETTERSTACK_WEBHOOK_SECRET fails closed when unset (see the dedicated describe block below);
  // every test in THIS block is exercising something else, so it opts out via the explicit
  // local-dev override rather than re-proving the auth gate each time.
  const okEnv: Env = {
    DISCORD_OPS_WEBHOOK_URL: "https://discord.com/api/webhooks/1/abc",
    ALLOW_UNAUTHENTICATED: "1",
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
    const res = await handleRequest(
      postRequest(INCIDENT_BODY),
      { ALLOW_UNAUTHENTICATED: "1" },
      fetcher,
    );
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

  test("an over-cap name/cause still delivers — truncation, not a 400 or a dropped alert", async () => {
    const { fetcher, calls } = fakeFetch(200);
    const overCap = {
      ...INCIDENT_BODY,
      data: {
        ...INCIDENT_BODY.data,
        attributes: {
          ...INCIDENT_BODY.data.attributes,
          name: "n".repeat(500),
          cause: "c".repeat(2000),
        },
      },
    };
    const res = await handleRequest(postRequest(overCap), okEnv, fetcher);
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
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

    test("no secret configured, no dev override → 401 (fail closed)", async () => {
      const { fetcher, calls } = fakeFetch(200);
      const res = await handleRequest(
        postRequest(INCIDENT_BODY),
        { DISCORD_OPS_WEBHOOK_URL: "https://discord.com/api/webhooks/1/abc" },
        fetcher,
      );
      expect(res.status).toBe(401);
      expect(calls).toHaveLength(0);
    });

    test("no secret configured, ALLOW_UNAUTHENTICATED set → 200 (explicit dev opt-out)", async () => {
      const { fetcher } = fakeFetch(200);
      const res = await handleRequest(
        postRequest(INCIDENT_BODY),
        okEnv, // no BETTERSTACK_WEBHOOK_SECRET, ALLOW_UNAUTHENTICATED: "1"
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
