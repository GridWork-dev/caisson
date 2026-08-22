import { describe, expect, test } from "bun:test";
import type { FetchTimeoutOptions } from "@caisson/kernel/fetch";
import {
  parseDemosOrigin,
  proxyDemosRequest,
  type DemosProxyDependencies,
} from "./demos-proxy";

describe("demos IAM proxy", () => {
  test("uses HTTPS plus Google IAM on Cloud Run and the private HTTP mesh only on Railway", () => {
    expect(parseDemosOrigin(undefined, {})).toBeNull();
    expect(
      parseDemosOrigin(" https://demos-abc-ue.a.run.app/path ", {
        K_SERVICE: "caisson-site",
      }),
    ).toEqual({
      origin: "https://demos-abc-ue.a.run.app",
      authorization: "google-id-token",
    });
    expect(
      parseDemosOrigin("http://caisson-demos.railway.internal:3040", {
        RAILWAY_ENVIRONMENT_ID: "railway-env",
      }),
    ).toEqual({
      origin: "http://caisson-demos.railway.internal:3040",
      authorization: "none",
    });
    expect(() =>
      parseDemosOrigin("http://caisson-demos.railway.internal:3040", {}),
    ).toThrow("private HTTP origin requires Railway");
    expect(() =>
      parseDemosOrigin("http://caisson-demos.railway.internal:3040", {
        RAILWAY_ENVIRONMENT_ID: "spoofed",
        K_SERVICE: "caisson-site",
      }),
    ).toThrow("private HTTP origin requires Railway");
  });

  test("mints an audience-bound token and keeps it server-side", async () => {
    let audience = "";
    let target = "";
    let upstreamAuthorization = "";
    let upstreamCookie = "";
    let timeoutMs = 0;
    const deps: DemosProxyDependencies = {
      getAuthorizationHeaders: (requestedAudience) => {
        audience = requestedAudience;
        return Promise.resolve(
          new Headers({ authorization: "Bearer google-signed-id-token" }),
        );
      },
      fetchImpl: (
        input: string | URL | Request,
        init?: RequestInit,
        options?: FetchTimeoutOptions,
      ) => {
        target = input.toString();
        const headers = new Headers(init?.headers);
        upstreamAuthorization = headers.get("authorization") ?? "";
        upstreamCookie = headers.get("cookie") ?? "";
        timeoutMs = options?.timeoutMs ?? 0;
        return Promise.resolve(
          new Response("demo", {
            status: 200,
            headers: {
              "content-security-policy": "frame-ancestors 'self'",
              "content-encoding": "br",
              "content-length": "4",
              "set-cookie": "upstream=must-not-leak",
            },
          }),
        );
      },
    };
    const request = new Request(
      "https://caisson.sh/demos/embed/audit-worm?mode=compact",
      {
        headers: {
          authorization: "Bearer browser-controlled",
          cookie: "site-session=must-not-cross",
          "x-gridwork-origin-secret": "must-not-cross",
          range: "bytes=0-99",
        },
      },
    );

    const response = await proxyDemosRequest(
      request,
      ["embed", "audit-worm"],
      parseDemosOrigin("https://demos-abc-ue.a.run.app", {
        K_SERVICE: "caisson-site",
      }),
      deps,
    );

    expect(audience).toBe("https://demos-abc-ue.a.run.app");
    expect(target).toBe(
      "https://demos-abc-ue.a.run.app/demos/embed/audit-worm?mode=compact",
    );
    expect(upstreamAuthorization).toBe("Bearer google-signed-id-token");
    expect(upstreamCookie).toBe("");
    expect(timeoutMs).toBeGreaterThan(0);
    expect(await response.text()).toBe("demo");
    expect(response.headers.get("content-security-policy")).toBe(
      "frame-ancestors 'self'",
    );
    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("authorization")).toBeNull();
  });

  test("preserves Railway private-mesh forwarding without minting a Google token", async () => {
    let requestedToken = false;
    let target = "";
    let upstreamAuthorization: string | null = "unexpected";
    const deps: DemosProxyDependencies = {
      getAuthorizationHeaders: () => {
        requestedToken = true;
        return Promise.resolve(new Headers());
      },
      fetchImpl: (input, init) => {
        target = input.toString();
        upstreamAuthorization = new Headers(init?.headers).get("authorization");
        return Promise.resolve(new Response("demo", { status: 200 }));
      },
    };

    const response = await proxyDemosRequest(
      new Request("https://caisson.sh/demos/embed/audit-worm"),
      ["embed", "audit-worm"],
      parseDemosOrigin("http://caisson-demos.railway.internal:3040", {
        RAILWAY_ENVIRONMENT_ID: "railway-env",
      }),
      deps,
    );

    expect(response.status).toBe(200);
    expect(target).toBe(
      "http://caisson-demos.railway.internal:3040/demos/embed/audit-worm",
    );
    expect(requestedToken).toBe(false);
    expect(upstreamAuthorization).toBeNull();
  });

  test("returns a fail-safe 404 without contacting IAM or demos when unconfigured", async () => {
    let contacted = false;
    const deps: DemosProxyDependencies = {
      getAuthorizationHeaders: () => {
        contacted = true;
        return Promise.resolve(new Headers());
      },
      fetchImpl: () => {
        contacted = true;
        return Promise.resolve(new Response());
      },
    };

    const response = await proxyDemosRequest(
      new Request("https://caisson.sh/demos"),
      [],
      null,
      deps,
    );

    expect(response.status).toBe(404);
    expect(contacted).toBe(false);
  });

  test("rejects a normalized path escape before requesting a token", async () => {
    let contacted = false;
    const deps: DemosProxyDependencies = {
      getAuthorizationHeaders: () => {
        contacted = true;
        return Promise.resolve(new Headers());
      },
      fetchImpl: () => {
        contacted = true;
        return Promise.resolve(new Response());
      },
    };

    await expect(
      proxyDemosRequest(
        new Request("https://caisson.sh/demos/%2e%2e/private"),
        ["..", "private"],
        parseDemosOrigin("https://demos-abc-ue.a.run.app", {
          K_SERVICE: "caisson-site",
        }),
        deps,
      ),
    ).rejects.toThrow("invalid demos path");
    expect(contacted).toBe(false);
  });
});
