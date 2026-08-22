import { describe, expect, test } from "bun:test";

const subject = await import("./smoke.ts").catch(() => undefined);

const securityHeaders = {
  "strict-transport-security": "max-age=31536000",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};
const originSecret = Buffer.alloc(32, 0x2a).toString("base64url");
const canaryUrls = {
  "caisson-site": "https://r42---caisson-site-example-ue.a.run.app",
  "caisson-admin": "https://r42---caisson-admin-example-ue.a.run.app",
  "caisson-license": "https://r42---caisson-license-example-ue.a.run.app",
  "caisson-docs": "https://r42---caisson-docs-example-ue.a.run.app",
  "caisson-demos": "https://r42---caisson-demos-example-ue.a.run.app",
};
const originSecrets = {
  "caisson-site": originSecret,
  "caisson-admin": originSecret,
  "caisson-license": originSecret,
  "caisson-docs": originSecret,
};

async function responseFor(
  _input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  if (init?.method === "POST") {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: securityHeaders },
    );
  }
  return Response.json({ ok: true }, { status: 200, headers: securityHeaders });
}

describe("public Caisson deployment smoke", () => {
  test("maps the staging workflow environment to a fail-closed smoke config", () => {
    expect(subject?.smokeConfigFromEnvironment).toBeFunction();
    if (!subject) return;

    expect(
      subject.smokeConfigFromEnvironment({
        ENVIRONMENT: "staging",
        CF_ACCESS_CLIENT_ID: "staging-id",
        CF_ACCESS_CLIENT_SECRET: "staging-secret",
      }),
    ).toEqual({
      environment: "staging",
      mode: "post-deploy",
      canaryTag: undefined,
      canaryUrls: undefined,
      originSecrets: undefined,
      service: undefined,
      accessClientId: "staging-id",
      accessClientSecret: "staging-secret",
    });
    expect(() =>
      subject.smokeConfigFromEnvironment({ ENVIRONMENT: "production" }),
    ).toThrow("MODE is required");
  });

  test("parses the workflow's canary JSON without exposing its values", () => {
    expect(subject?.smokeConfigFromEnvironment).toBeFunction();
    if (!subject) return;

    expect(
      subject.smokeConfigFromEnvironment({
        ENVIRONMENT: "production",
        MODE: "pre-migration",
        CANARY_TAG: "r42",
        CANARY_URLS: JSON.stringify(canaryUrls),
        ORIGIN_SECRETS: JSON.stringify(originSecrets),
      }),
    ).toMatchObject({
      environment: "production",
      mode: "pre-migration",
      canaryTag: "r42",
      canaryUrls,
      originSecrets,
    });
    expect(() =>
      subject.smokeConfigFromEnvironment({
        ENVIRONMENT: "production",
        MODE: "pre-migration",
        CANARY_URLS: "not-json",
      }),
    ).toThrow("CANARY_URLS must be valid JSON");
  });

  test("covers every service through Cloudflare and proxies demos through the site", async () => {
    expect(subject?.runSmoke).toBeFunction();
    if (!subject) return;

    const calls: Array<{ url: string; method: string; headers: Headers }> = [];
    await subject.runSmoke(
      {
        environment: "production",
        mode: "post-deploy",
        accessClientId: "client-id",
        accessClientSecret: "client-secret",
      },
      async (input, init) => {
        calls.push({
          url: String(input),
          method: init?.method ?? "GET",
          headers: new Headers(init?.headers),
        });
        return responseFor(input, init);
      },
    );

    expect(calls.map(({ url, method }) => `${method} ${url}`)).toEqual([
      "GET https://caisson.sh/healthz",
      "GET https://caisson.sh/",
      "GET https://admin.caisson.sh/healthz",
      "GET https://license.caisson.sh/health",
      "GET https://docs-api.caisson.sh/health",
      "GET https://caisson.sh/demos/healthz",
      "POST https://license.caisson.sh/issue",
      "POST https://docs-api.caisson.sh/query",
    ]);
    expect(calls.some(({ url }) => url.includes("run.app"))).toBe(false);
    expect(calls.some(({ url }) => url.includes("caisson-demos."))).toBe(false);
    expect(calls[2]?.headers.get("cf-access-client-id")).toBe("client-id");
    expect(calls[0]?.headers.has("cf-access-client-id")).toBe(false);
  });

  test("sends Access credentials on every staging request and rejects the login redirect", async () => {
    expect(subject?.runSmoke).toBeFunction();
    if (!subject) return;

    const calls: Array<{
      headers: Headers;
      redirect: RequestRedirect | undefined;
    }> = [];
    await subject.runSmoke(
      {
        environment: "staging",
        mode: "post-deploy",
        accessClientId: "staging-id",
        accessClientSecret: "staging-secret",
      },
      async (input, init) => {
        calls.push({
          headers: new Headers(init?.headers),
          redirect: init?.redirect,
        });
        return responseFor(input, init);
      },
    );

    expect(calls).toHaveLength(8);
    for (const call of calls) {
      expect(call.redirect).toBe("manual");
      expect(call.headers.get("cf-access-client-id")).toBe("staging-id");
      expect(call.headers.get("cf-access-client-secret")).toBe(
        "staging-secret",
      );
    }

    await expect(
      subject.runSmoke(
        {
          environment: "staging",
          mode: "post-deploy",
          accessClientId: "staging-id",
          accessClientSecret: "staging-secret",
        },
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: "https://access.example/login" },
          }),
      ),
    ).rejects.toThrow("caisson-site health returned 302");
  });

  test("smokes zero-traffic tag URLs directly with each service's origin header", async () => {
    expect(subject?.runSmoke).toBeFunction();
    if (!subject) return;

    const calls: Array<{ url: string; method: string; headers: Headers }> = [];
    await subject.runSmoke(
      {
        environment: "production",
        mode: "post-migration",
        canaryTag: "r42",
        canaryUrls,
        originSecrets,
        // The workflow still supplies this optional pair, but Cloudflare Access is not
        // in the direct tag path and these headers must not reach run.app.
        accessClientId: "access-id",
        accessClientSecret: "access-secret",
      },
      async (input, init) => {
        calls.push({
          url: String(input),
          method: init?.method ?? "GET",
          headers: new Headers(init?.headers),
        });
        return responseFor(input, init);
      },
    );

    expect(calls.map(({ url, method }) => `${method} ${url}`)).toEqual([
      `GET ${canaryUrls["caisson-site"]}/healthz`,
      `GET ${canaryUrls["caisson-site"]}/`,
      `GET ${canaryUrls["caisson-admin"]}/healthz`,
      `GET ${canaryUrls["caisson-license"]}/health`,
      `GET ${canaryUrls["caisson-docs"]}/health`,
      `GET ${canaryUrls["caisson-demos"]}/demos/healthz`,
      `POST ${canaryUrls["caisson-license"]}/issue`,
      `POST ${canaryUrls["caisson-docs"]}/query`,
    ]);
    for (const call of calls) {
      expect(call.headers.has("cf-access-client-id")).toBe(false);
      expect(call.headers.has("cf-access-client-secret")).toBe(false);
      const service = Object.entries(canaryUrls).find(([, url]) =>
        call.url.startsWith(url),
      )?.[0];
      expect(call.headers.get("x-gridwork-origin-secret")).toBe(
        service === "caisson-demos" ? null : originSecret,
      );
    }
  });

  test("keeps pre-migration canary smoke free of schema-dependent writes", async () => {
    expect(subject?.runSmoke).toBeFunction();
    if (!subject) return;

    const methods: string[] = [];
    await subject.runSmoke(
      {
        environment: "production",
        mode: "pre-migration",
        canaryTag: "r42",
        canaryUrls: {
          "caisson-license": canaryUrls["caisson-license"],
          "caisson-docs": canaryUrls["caisson-docs"],
        },
        originSecrets,
      },
      async (input, init) => {
        methods.push(init?.method ?? "GET");
        return responseFor(input, init);
      },
    );
    expect(methods).toEqual(["GET", "GET"]);
  });

  test("requires valid mode, tag, and Access credentials", async () => {
    expect(subject?.runSmoke).toBeFunction();
    if (!subject) return;

    await expect(
      subject.runSmoke({ environment: "preview", mode: "post-deploy" }),
    ).rejects.toThrow("ENVIRONMENT must be staging or production");
    await expect(
      subject.runSmoke({ environment: "production", mode: "pre-migration" }),
    ).rejects.toThrow("CANARY_TAG is required");
    await expect(
      subject.runSmoke({
        environment: "production",
        mode: "pre-migration",
        canaryTag: "bad tag",
      }),
    ).rejects.toThrow("CANARY_TAG is invalid");
    await expect(
      subject.runSmoke({
        environment: "production",
        mode: "pre-migration",
        canaryTag: "r42",
      }),
    ).rejects.toThrow("CANARY_URLS is required for canary smoke");
    await expect(
      subject.runSmoke({
        environment: "production",
        mode: "pre-migration",
        canaryTag: "r42",
        canaryUrls: {
          "caisson-site": "https://credential-sink.example",
        },
        originSecrets,
      }),
    ).rejects.toThrow("CANARY_URLS is invalid");
    await expect(
      subject.runSmoke({
        environment: "production",
        mode: "pre-migration",
        canaryTag: "r42",
        canaryUrls: { "caisson-admin": canaryUrls["caisson-admin"] },
        originSecrets: {},
      }),
    ).rejects.toThrow("ORIGIN_SECRETS is missing caisson-admin");
    await expect(
      subject.runSmoke({
        environment: "production",
        mode: "pre-migration",
        canaryTag: "r42",
        canaryUrls: { "caisson-site": canaryUrls["caisson-site"] },
        originSecrets: { "caisson-site": "not-a-canonical-secret" },
      }),
    ).rejects.toThrow("ORIGIN_SECRETS is invalid");
    await expect(
      subject.runSmoke({
        environment: "production",
        mode: "post-deploy",
        canaryUrls,
        originSecrets,
        accessClientId: "client-id",
        accessClientSecret: "client-secret",
      }),
    ).rejects.toThrow("canary inputs are forbidden for post-deploy smoke");
    await expect(
      subject.runSmoke({ environment: "production", mode: "post-deploy" }),
    ).rejects.toThrow("Cloudflare Access service credentials are required");
    await expect(
      subject.runSmoke(
        {
          environment: "production",
          mode: "post-deploy",
          accessClientId: "client-id\r\ninjected: true",
          accessClientSecret: "client-secret",
        },
        responseFor,
      ),
    ).rejects.toThrow("smoke configuration is invalid");
  });

  test("fails on public status, headers, or write-boundary regressions", async () => {
    expect(subject?.runSmoke).toBeFunction();
    if (!subject) return;

    const config = {
      environment: "production",
      mode: "post-deploy",
      accessClientId: "client-id",
      accessClientSecret: "client-secret",
    };
    await expect(
      subject.runSmoke(
        config,
        async () => new Response("bad", { status: 503 }),
      ),
    ).rejects.toThrow("returned 503");
    await expect(
      subject.runSmoke(config, async (input, init) => {
        const response = await responseFor(input, init);
        response.headers.delete("strict-transport-security");
        return response;
      }),
    ).rejects.toThrow("missing strict-transport-security");
    await expect(
      subject.runSmoke(config, async (input, init) => {
        if (init?.method === "POST") return new Response(null, { status: 200 });
        return responseFor(input, init);
      }),
    ).rejects.toThrow("write auth boundary returned 200");
  });
});
