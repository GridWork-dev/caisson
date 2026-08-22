import { beforeAll, describe, expect, test } from "bun:test";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTVerifyGetKey,
} from "jose";
import { ConfigError } from "@caisson/kernel";
import {
  loadOriginGateConfig,
  type OriginGateConfig,
} from "@caisson/kernel/node";
import { NextRequest, type NextResponse } from "next/server";

const accessModule = await import("./cloudflare-access.ts").catch(() => null);
const verifyCloudflareAccessRequest =
  accessModule === null
    ? undefined
    : (Reflect.get(accessModule, "verifyCloudflareAccessRequest") as
        | ((request: Request, config: TestAccessConfig) => Promise<boolean>)
        | undefined);
const loadCloudflareAccessConfig =
  accessModule === null
    ? undefined
    : (Reflect.get(accessModule, "loadCloudflareAccessConfig") as
        | ((env: Record<string, string | undefined>) => unknown)
        | undefined);
const previousNodeEnv = process.env.NODE_ENV;
const previousOriginMode = process.env.ORIGIN_SECRET_MODE;
const previousAccessMode = process.env.CF_ACCESS_MODE;
Reflect.set(process.env, "NODE_ENV", "test");
Reflect.set(process.env, "ORIGIN_SECRET_MODE", "disabled");
Reflect.set(process.env, "CF_ACCESS_MODE", "disabled");
const proxyModule = await import("../proxy.ts");
if (previousNodeEnv === undefined)
  Reflect.deleteProperty(process.env, "NODE_ENV");
else Reflect.set(process.env, "NODE_ENV", previousNodeEnv);
if (previousOriginMode === undefined)
  Reflect.deleteProperty(process.env, "ORIGIN_SECRET_MODE");
else Reflect.set(process.env, "ORIGIN_SECRET_MODE", previousOriginMode);
if (previousAccessMode === undefined)
  Reflect.deleteProperty(process.env, "CF_ACCESS_MODE");
else Reflect.set(process.env, "CF_ACCESS_MODE", previousAccessMode);
const createAdminProxy = Reflect.get(proxyModule, "createAdminProxy") as
  | ((options: {
      originGate: OriginGateConfig;
      access: TestAccessConfig;
    }) => (request: NextRequest) => Promise<NextResponse>)
  | undefined;

interface TestAccessConfig {
  required: true;
  issuer: string;
  audience: string;
  jwks: JWTVerifyGetKey;
}

const ISSUER = "https://caisson.cloudflareaccess.com";
const AUDIENCE = "a".repeat(64);
const KID = "access-test-key";
const ORIGIN_CURRENT = Buffer.alloc(32, 0x71).toString("base64url");
const ORIGIN_NEXT = Buffer.alloc(32, 0x72).toString("base64url");
let privateKey: CryptoKey;
let otherPrivateKey: CryptoKey;
let config: TestAccessConfig;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  const otherPair = await generateKeyPair("RS256", { extractable: true });
  privateKey = pair.privateKey;
  otherPrivateKey = otherPair.privateKey;
  const publicJwk = await exportJWK(pair.publicKey);
  config = {
    required: true,
    issuer: ISSUER,
    audience: AUDIENCE,
    jwks: createLocalJWKSet({
      keys: [{ ...publicJwk, alg: "RS256", kid: KID, use: "sig" }],
    }),
  };
});

function requireVerifier(): NonNullable<typeof verifyCloudflareAccessRequest> {
  expect(verifyCloudflareAccessRequest).toBeFunction();
  if (verifyCloudflareAccessRequest === undefined) {
    throw new Error("Cloudflare Access verifier is not implemented");
  }
  return verifyCloudflareAccessRequest;
}

async function token(
  options: {
    issuer?: string;
    audience?: string;
    expiresInSec?: number;
    notBeforeSec?: number;
    includeIdentity?: boolean;
    serviceToken?: boolean;
    signingKey?: CryptoKey;
  } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = options.serviceToken
    ? { type: "app", common_name: "smoke-client.access" }
    : options.includeIdentity === false
      ? { type: "app" }
      : {
          type: "app",
          email: "admin@gridwork.dev",
          identity_nonce: "identity-nonce-1",
        };

  let jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: KID, typ: "JWT" })
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? AUDIENCE)
    .setSubject(options.serviceToken ? "" : "access-user-1")
    .setIssuedAt(now)
    .setExpirationTime(now + (options.expiresInSec ?? 60));
  if (!options.serviceToken) {
    jwt = jwt.setNotBefore(now + (options.notBeforeSec ?? -1));
  }
  return jwt.sign(options.signingKey ?? privateKey);
}

const request = (jwt?: string): Request =>
  new Request(
    "https://admin.caisson.sh/healthz",
    jwt === undefined ? {} : { headers: { "Cf-Access-Jwt-Assertion": jwt } },
  );

describe("verifyCloudflareAccessRequest", () => {
  test("accepts a signed, audience-bound identity token", async () => {
    expect(await requireVerifier()(request(await token()), config)).toBe(true);
  });

  test("accepts a signed, audience-bound service-token assertion", async () => {
    expect(
      await requireVerifier()(
        request(await token({ serviceToken: true })),
        config,
      ),
    ).toBe(true);
  });

  test("rejects missing tokens and tokens signed by an unknown key", async () => {
    expect(await requireVerifier()(request(), config)).toBe(false);
    expect(
      await requireVerifier()(
        request(await token({ signingKey: otherPrivateKey })),
        config,
      ),
    ).toBe(false);
  });

  test("rejects wrong issuer and wrong audience tokens", async () => {
    expect(
      await requireVerifier()(
        request(await token({ issuer: "https://evil.cloudflareaccess.com" })),
        config,
      ),
    ).toBe(false);
    expect(
      await requireVerifier()(
        request(await token({ audience: "b".repeat(64) })),
        config,
      ),
    ).toBe(false);
  });

  test("rejects expired and not-yet-valid tokens", async () => {
    expect(
      await requireVerifier()(
        request(await token({ expiresInSec: -60 })),
        config,
      ),
    ).toBe(false);
    expect(
      await requireVerifier()(
        request(await token({ notBeforeSec: 60 })),
        config,
      ),
    ).toBe(false);
  });

  test("rejects tokens without the required identity claims", async () => {
    expect(
      await requireVerifier()(
        request(await token({ includeIdentity: false })),
        config,
      ),
    ).toBe(false);
  });
});

describe("loadCloudflareAccessConfig", () => {
  test("is disabled only by the exact nonproduction opt-out", () => {
    expect(loadCloudflareAccessConfig).toBeFunction();
    if (loadCloudflareAccessConfig === undefined) return;
    expect(
      loadCloudflareAccessConfig({
        NODE_ENV: "test",
        CF_ACCESS_MODE: "disabled",
      }),
    ).toEqual({ required: false });
  });

  test("an absent mode stays armed while a production disable cannot bypass Access", () => {
    expect(loadCloudflareAccessConfig).toBeFunction();
    if (loadCloudflareAccessConfig === undefined) return;
    // The sharp case: team domain and audience mount correctly, the flag row is dropped. Admin's
    // sessionExempt paths delegate their protection to this layer, so absence must arm it.
    const absentMode = loadCloudflareAccessConfig({
      NODE_ENV: "production",
      CF_ACCESS_TEAM_DOMAIN: "example.cloudflareaccess.com",
      CF_ACCESS_AUD: "a".repeat(64),
    }) as { required: boolean };
    expect(absentMode.required).toBe(true);
    expect(() =>
      loadCloudflareAccessConfig({ NODE_ENV: "production" }),
    ).toThrow(ConfigError);
    expect(() =>
      loadCloudflareAccessConfig({
        NODE_ENV: "production",
        CF_ACCESS_MODE: "disabled",
      }),
    ).toThrow(ConfigError);
    expect(() =>
      loadCloudflareAccessConfig({ CF_ACCESS_MODE: "disabled" }),
    ).toThrow(ConfigError);
  });

  test("preserves the established bare team-domain env contract", () => {
    expect(loadCloudflareAccessConfig).toBeFunction();
    if (loadCloudflareAccessConfig === undefined) return;

    const loaded = loadCloudflareAccessConfig({
      NODE_ENV: "production",
      CF_ACCESS_MODE: "enabled",
      CF_ACCESS_TEAM_DOMAIN: "caisson.cloudflareaccess.com",
      CF_ACCESS_AUD: AUDIENCE,
    }) as { required: boolean; issuer?: string; audience?: string };

    expect(loaded.required).toBe(true);
    expect(loaded.issuer).toBe(ISSUER);
    expect(loaded.audience).toBe(AUDIENCE);
  });

  test("fails closed on missing or malformed required configuration", () => {
    expect(loadCloudflareAccessConfig).toBeFunction();
    if (loadCloudflareAccessConfig === undefined) return;

    expect(() =>
      loadCloudflareAccessConfig({ CF_ACCESS_MODE: "enabled" }),
    ).toThrow(ConfigError);
    expect(() =>
      loadCloudflareAccessConfig({
        CF_ACCESS_MODE: "enabled",
        CF_ACCESS_TEAM_DOMAIN: "http://caisson.cloudflareaccess.com",
        CF_ACCESS_AUD: AUDIENCE,
      }),
    ).toThrow(ConfigError);
    expect(() =>
      loadCloudflareAccessConfig({
        CF_ACCESS_MODE: "enabled",
        CF_ACCESS_TEAM_DOMAIN: "caisson.cloudflareaccess.com",
        CF_ACCESS_AUD: "not-an-audience",
      }),
    ).toThrow(ConfigError);
  });
});

describe("admin proxy edge composition", () => {
  function handler(): (request: NextRequest) => Promise<NextResponse> {
    expect(createAdminProxy).toBeFunction();
    if (createAdminProxy === undefined) {
      throw new Error("admin edge proxy factory is not implemented");
    }
    return createAdminProxy({
      originGate: loadOriginGateConfig({
        NODE_ENV: "production",
        ORIGIN_SECRET: ORIGIN_CURRENT,
        ORIGIN_SECRET_NEXT: ORIGIN_NEXT,
      }),
      access: config,
    });
  }

  test("rejects /healthz without the origin secret even when Access is valid", async () => {
    const response = await handler()(
      new NextRequest("https://admin.caisson.sh/healthz", {
        headers: { "Cf-Access-Jwt-Assertion": await token() },
      }),
    );
    expect(response.status).toBe(403);
  });

  test("rejects a trailing-slash path that Next used to redirect ahead of both gates", async () => {
    // The sharp case: `/healthz/` matched Next's internal `/:path+/` redirect, which resolves
    // before the proxy entry, so it answered 308 on the raw run.app hostname without passing the
    // origin gate OR the Access check. `skipTrailingSlashRedirect` moves normalization behind both.
    for (const path of ["/healthz/", "/login/", "/api/auth/session/"]) {
      const response = await handler()(
        new NextRequest(`https://admin.caisson.sh${path}`),
      );
      expect(response.status).toBe(403);
    }
  });

  test("normalizes a trailing slash only after both edge gates pass", async () => {
    const response = await handler()(
      new NextRequest("https://admin.caisson.sh/healthz/", {
        headers: {
          "Cf-Access-Jwt-Assertion": await token(),
          "x-gridwork-origin-secret": ORIGIN_CURRENT,
        },
      }),
    );
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://admin.caisson.sh/healthz",
    );
  });

  test("independently rejects an /api route without the origin secret even when Access is valid", async () => {
    const response = await handler()(
      new NextRequest("https://admin.caisson.sh/api/admin/fleet", {
        headers: { "Cf-Access-Jwt-Assertion": await token() },
      }),
    );
    expect(response.status).toBe(403);
  });

  test("allows origin-authenticated exact health but keeps Access on every other route", async () => {
    const health = await handler()(
      new NextRequest("https://admin.caisson.sh/healthz", {
        headers: { "x-gridwork-origin-secret": ORIGIN_CURRENT },
      }),
    );
    expect(health.status).toBe(200);

    for (const path of ["/healthz/", "/login", "/api/admin/fleet"]) {
      const response = await handler()(
        new NextRequest(`https://admin.caisson.sh${path}`, {
          headers: { "x-gridwork-origin-secret": ORIGIN_CURRENT },
        }),
      );
      expect(response.status).toBe(403);
    }
  });

  test("accepts current and next origin secrets when Access is valid", async () => {
    const jwt = await token();
    for (const secret of [ORIGIN_CURRENT, ORIGIN_NEXT]) {
      const response = await handler()(
        new NextRequest("https://admin.caisson.sh/healthz", {
          headers: {
            "x-gridwork-origin-secret": secret,
            "Cf-Access-Jwt-Assertion": jwt,
          },
        }),
      );
      expect(response.status).toBe(200);
    }
  });
});
