import { afterEach, describe, expect, test } from "bun:test";
import { ConfigError } from "@caisson-sh/kernel";
import { createWorkosSsoProvider } from "./index.ts";

const CONFIG = {
  clientId: "client_123",
  apiKey: "sk_test_workos",
  redirectUri: "https://app.test/callback",
};

describe("createWorkosSsoProvider — config fail-closed", () => {
  test("throws ConfigError when required config is missing", () => {
    expect(() => createWorkosSsoProvider({ ...CONFIG, clientId: "" })).toThrow(
      ConfigError,
    );
    expect(() => createWorkosSsoProvider({ ...CONFIG, apiKey: "" })).toThrow(
      ConfigError,
    );
    expect(() =>
      createWorkosSsoProvider({ ...CONFIG, redirectUri: "" }),
    ).toThrow(ConfigError);
  });
});

describe("createWorkosSsoProvider — authorizationUrl", () => {
  test("builds the AuthKit fallback URL when no connectionId is configured", () => {
    const provider = createWorkosSsoProvider(CONFIG);
    const url = new URL(provider.authorizationUrl("state_abc"));
    expect(url.origin + url.pathname).toBe(
      "https://api.workos.com/sso/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("client_123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.test/callback",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("state_abc");
    expect(url.searchParams.get("provider")).toBe("authkit");
    expect(url.searchParams.has("connection")).toBe(false);
  });

  test("targets a specific connection when connectionId is configured", () => {
    const provider = createWorkosSsoProvider({
      ...CONFIG,
      connectionId: "conn_xyz",
    });
    const url = new URL(provider.authorizationUrl("state_def"));
    expect(url.searchParams.get("connection")).toBe("conn_xyz");
    expect(url.searchParams.has("provider")).toBe(false);
  });
});

describe("createWorkosSsoProvider — exchangeCode", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("POSTs the code to /sso/token and maps the response to {userId, email}", async () => {
    let capturedUrl: string | undefined;
    let capturedBody: string | undefined;
    globalThis.fetch = (async (url: unknown, init?: { body?: string }) => {
      capturedUrl = String(url);
      capturedBody = init?.body;
      return new Response(
        JSON.stringify({
          access_token: "at_1",
          profile: {
            object: "profile",
            id: "prof_1",
            connection_id: "conn_xyz",
            connection_type: "GenericOIDC",
            email: "person@example.com",
            idp_id: "idp_1",
            role: { slug: "member" },
            custom_attributes: {},
          },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const provider = createWorkosSsoProvider(CONFIG);
    const profile = await provider.exchangeCode("code_1");

    expect(profile).toEqual({ userId: "prof_1", email: "person@example.com" });
    expect(capturedUrl).toBe("https://api.workos.com/sso/token");
    const body = JSON.parse(capturedBody ?? "{}") as Record<string, unknown>;
    expect(body).toEqual({
      client_id: "client_123",
      client_secret: "sk_test_workos",
      code: "code_1",
      grant_type: "authorization_code",
    });
  });

  test("throws without leaking the response body on a non-ok response", async () => {
    globalThis.fetch = (async () =>
      new Response("client_secret sk_test_workos is invalid", {
        status: 401,
      })) as unknown as typeof fetch;

    const provider = createWorkosSsoProvider(CONFIG);
    await expect(provider.exchangeCode("bad_code")).rejects.toThrow(
      "WorkOS SSO code exchange failed",
    );
  });

  test("rejects a malformed token response (missing required profile field)", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          access_token: "at_1",
          profile: { object: "profile" },
        }),
        { status: 200 },
      )) as unknown as typeof fetch;

    const provider = createWorkosSsoProvider(CONFIG);
    await expect(provider.exchangeCode("code_1")).rejects.toThrow();
  });
});
