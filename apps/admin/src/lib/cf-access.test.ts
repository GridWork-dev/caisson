// CF Access JWT verification tests (Strix vuln-0003). The load-bearing cases: a token signed by the
// wrong key is rejected (an attacker cannot forge one), and — critically — a validly-signed token with
// the WRONG `aud` is rejected (the site + admin Access apps share one email policy, so a site JWT must
// not open admin). A local RS256 keypair stands in for Cloudflare's JWKS; the public key is injected as
// the resolver, exercising the exact `jwtVerify` path the middleware runs against the remote JWKS.
import { describe, expect, test } from "bun:test";
import { SignJWT, generateKeyPair } from "jose";
import {
  accessConfig,
  extractAccessToken,
  verifyAccessJwt,
} from "./cf-access.ts";

const CFG = {
  teamDomain: "gridwork.cloudflareaccess.com",
  aud: "admin-app-aud-tag",
};

const { publicKey, privateKey } = await generateKeyPair("RS256");
// A DIFFERENT keypair — a token signed with this is an attacker forgery relative to `publicKey`.
const attacker = await generateKeyPair("RS256");

async function sign(
  key: CryptoKey,
  claims: { aud?: string; iss?: string; expSecondsFromNow?: number } = {},
): Promise<string> {
  const now = 1_800_000_000; // fixed epoch — no Date.now (deterministic)
  return new SignJWT({ email: "op@gridwork.dev" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(now)
    .setIssuer(claims.iss ?? `https://${CFG.teamDomain}`)
    .setAudience(claims.aud ?? CFG.aud)
    .setExpirationTime(now + (claims.expSecondsFromNow ?? 3600))
    .sign(key);
}

describe("accessConfig", () => {
  test("returns null when either var is unset/blank", () => {
    expect(accessConfig({})).toBeNull();
    expect(accessConfig({ CF_ACCESS_TEAM_DOMAIN: "x" })).toBeNull();
    expect(accessConfig({ CF_ACCESS_AUD: "y" })).toBeNull();
    expect(
      accessConfig({ CF_ACCESS_TEAM_DOMAIN: "  ", CF_ACCESS_AUD: "y" }),
    ).toBeNull();
  });

  test("returns the config when both are set", () => {
    expect(
      accessConfig({
        CF_ACCESS_TEAM_DOMAIN: "t.example",
        CF_ACCESS_AUD: "aud",
      }),
    ).toEqual({ teamDomain: "t.example", aud: "aud" });
  });
});

describe("extractAccessToken", () => {
  test("reads the Cf-Access-Jwt-Assertion header", () => {
    const req = new Request("http://admin.test/", {
      headers: { "cf-access-jwt-assertion": "tok123" },
    });
    expect(extractAccessToken(req)).toBe("tok123");
  });

  test("falls back to the CF_Authorization cookie", () => {
    const req = new Request("http://admin.test/", {
      headers: { cookie: "other=1; CF_Authorization=tokABC; more=2" },
    });
    expect(extractAccessToken(req)).toBe("tokABC");
  });

  test("returns null when neither is present", () => {
    expect(extractAccessToken(new Request("http://admin.test/"))).toBeNull();
  });
});

describe("verifyAccessJwt", () => {
  test("accepts a validly-signed token with the correct aud + iss", async () => {
    const token = await sign(privateKey);
    // A fixed clock inside the token's validity window (setExpirationTime above is absolute).
    await expect(
      verifyAccessJwt(token, CFG, publicKey, {
        currentDate: new Date(1_800_000_100 * 1000),
      }),
    ).resolves.toBeUndefined();
  });

  test("REJECTS a validly-signed token with the WRONG aud (a site JWT must not open admin)", async () => {
    const siteToken = await sign(privateKey, { aud: "site-app-aud-tag" });
    await expect(
      verifyAccessJwt(siteToken, CFG, publicKey, {
        currentDate: new Date(1_800_000_100 * 1000),
      }),
    ).rejects.toThrow();
  });

  test("REJECTS a token signed by a different key (forgery)", async () => {
    const forged = await sign(attacker.privateKey);
    await expect(
      verifyAccessJwt(forged, CFG, publicKey, {
        currentDate: new Date(1_800_000_100 * 1000),
      }),
    ).rejects.toThrow();
  });

  test("REJECTS a token from the wrong issuer", async () => {
    const wrongIss = await sign(privateKey, { iss: "https://evil.example" });
    await expect(
      verifyAccessJwt(wrongIss, CFG, publicKey, {
        currentDate: new Date(1_800_000_100 * 1000),
      }),
    ).rejects.toThrow();
  });

  test("REJECTS an expired token", async () => {
    const token = await sign(privateKey, { expSecondsFromNow: 60 });
    // Clock well past expiry.
    await expect(
      verifyAccessJwt(token, CFG, publicKey, {
        currentDate: new Date((1_800_000_000 + 3600) * 1000),
      }),
    ).rejects.toThrow();
  });
});
