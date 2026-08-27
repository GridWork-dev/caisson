import { describe, expect, test } from "bun:test";
import { classifyEvent, handleRequest, toDiscordEmbed } from "./handler.ts";
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

// Timing-safe comparison behavior is canonically tested in packages/kernel/src/crypto.test.ts
// (safeEqualVariable) — the route-level 401/200 tests below cover this Worker's use of it.

describe("handleRequest", () => {
  // Auth is mandatory (no unauthenticated mode); every test in this block is exercising
  // something else, so it authenticates with a real local fixture secret + header.
  const FIXTURE_SECRET = "test-fixture-secret";
  const AUTH_HEADER = { "x-betterstack-secret": FIXTURE_SECRET };
  const okEnv: Env = {
    DISCORD_OPS_WEBHOOK_URL: "https://discord.com/api/webhooks/1/abc",
    BETTERSTACK_WEBHOOK_SECRET: FIXTURE_SECRET,
  };
  const authedPost = (body: unknown): Request => postRequest(body, AUTH_HEADER);

  test("rejects a non-POST method", async () => {
    const { fetcher } = fakeFetch(200);
    const res = await handleRequest(
      new Request("https://adapter.example.com/", { method: "GET" }),
      okEnv,
      fetcher,
    );
    expect(res.status).toBe(405);
  });

  test("every response path carries the security-floor headers, the 401 included", async () => {
    // The absence of this assertion is the mechanism that let the headers go missing: nothing
    // repo-wide enforces the floor (a grep of tooling/, tools/ and .github/workflows/ for
    // `nosniff` returns zero hits), so each service asserts its own. Swept per path rather than
    // once on the happy path — a single sampled response cannot show that the deny paths, which
    // are the ones an attacker actually reaches, carry them too.
    const { fetcher } = fakeFetch(200);
    const paths: ReadonlyArray<readonly [string, Request]> = [
      [
        "405 non-POST",
        new Request("https://adapter.example.com/", { method: "GET" }),
      ],
      ["401 no secret", postRequest(INCIDENT_BODY, {})],
      [
        "401 wrong secret",
        postRequest(INCIDENT_BODY, { "x-betterstack-secret": "wrong" }),
      ],
      [
        "400 invalid JSON",
        new Request("https://adapter.example.com/", {
          method: "POST",
          headers: AUTH_HEADER,
          body: "not json",
        }),
      ],
      ["400 wrong shape", authedPost({ hello: "world" })],
      ["200 delivered", authedPost(INCIDENT_BODY)],
    ];

    for (const [label, req] of paths) {
      const res = await handleRequest(req, okEnv, fetcher);
      expect({
        label,
        nosniff: res.headers.get("x-content-type-options"),
        frame: res.headers.get("x-frame-options"),
        hsts: res.headers.get("strict-transport-security"),
      }).toEqual({
        label,
        nosniff: "nosniff",
        frame: "DENY",
        hsts: "max-age=31536000; includeSubDomains",
      });
    }
  });

  test("rejects invalid JSON", async () => {
    const { fetcher } = fakeFetch(200);
    const req = new Request("https://adapter.example.com/", {
      method: "POST",
      headers: AUTH_HEADER,
      body: "not json",
    });
    const res = await handleRequest(req, okEnv, fetcher);
    expect(res.status).toBe(400);
  });

  test("rejects a payload that doesn't match the expected shape", async () => {
    const { fetcher } = fakeFetch(200);
    const res = await handleRequest(
      authedPost({ hello: "world" }),
      okEnv,
      fetcher,
    );
    expect(res.status).toBe(400);
  });

  test("an unrecognized field inside attributes is ignored, not rejected (non-.strict())", async () => {
    const { fetcher, calls } = fakeFetch(200);
    const res = await handleRequest(authedPost(INCIDENT_BODY), okEnv, fetcher);
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  test("500 when DISCORD_OPS_WEBHOOK_URL is not configured — no delivery attempted", async () => {
    const { fetcher, calls } = fakeFetch(200);
    const res = await handleRequest(
      authedPost(INCIDENT_BODY),
      { BETTERSTACK_WEBHOOK_SECRET: FIXTURE_SECRET },
      fetcher,
    );
    expect(res.status).toBe(500);
    expect(calls).toHaveLength(0);
  });

  test("502 when the Discord POST fails (non-2xx)", async () => {
    const { fetcher } = fakeFetch(500);
    const res = await handleRequest(authedPost(INCIDENT_BODY), okEnv, fetcher);
    expect(res.status).toBe(502);
  });

  test("502 when the Discord POST throws — never propagates", async () => {
    const throwingFetch = (() =>
      Promise.reject(new Error("ECONNREFUSED"))) as unknown as Fetcher;
    const res = await handleRequest(
      authedPost(INCIDENT_BODY),
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
    const res = await handleRequest(authedPost(overCap), okEnv, fetcher);
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  test("posts the reshaped embed body to the configured Discord webhook", async () => {
    const { fetcher, calls } = fakeFetch(200);
    const res = await handleRequest(authedPost(INCIDENT_BODY), okEnv, fetcher);
    expect(res.status).toBe(200);
    expect(calls[0]?.url).toBe(okEnv.DISCORD_OPS_WEBHOOK_URL);
    const body = JSON.parse(calls[0]?.body ?? "{}") as {
      embeds: Array<{ title: string }>;
    };
    expect(body.embeds[0]?.title).toBe("[TRIGGERED] Tesla.com homepage");
  });

  describe("BETTERSTACK_WEBHOOK_SECRET gating", () => {
    test("no secret configured → 401 (fail closed, no unauthenticated mode)", async () => {
      const { fetcher, calls } = fakeFetch(200);
      const res = await handleRequest(
        authedPost(INCIDENT_BODY),
        { DISCORD_OPS_WEBHOOK_URL: "https://discord.com/api/webhooks/1/abc" },
        fetcher,
      );
      expect(res.status).toBe(401);
      expect(calls).toHaveLength(0);
    });

    test("secret configured, header missing → 401, no delivery attempted", async () => {
      const { fetcher, calls } = fakeFetch(200);
      const res = await handleRequest(
        postRequest(INCIDENT_BODY),
        okEnv,
        fetcher,
      );
      expect(res.status).toBe(401);
      expect(calls).toHaveLength(0);
    });

    test("secret configured, header wrong → 401", async () => {
      const { fetcher } = fakeFetch(200);
      const res = await handleRequest(
        postRequest(INCIDENT_BODY, { "x-betterstack-secret": "nope" }),
        okEnv,
        fetcher,
      );
      expect(res.status).toBe(401);
    });

    test("secret configured, header matches → 200, delivered", async () => {
      const { fetcher, calls } = fakeFetch(200);
      const res = await handleRequest(
        authedPost(INCIDENT_BODY),
        okEnv,
        fetcher,
      );
      expect(res.status).toBe(200);
      expect(calls).toHaveLength(1);
    });
  });
});
