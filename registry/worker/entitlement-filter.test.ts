// licenseEntitlementResolver — the Worker's offline license → purchased-ids path (ADR-0010/0047/0071).
// Drives the REAL @caisson/license-verify Ed25519 verify logic with a RUNTIME-MINTED dev-key token
// through the injectable verify seam (`devVerify`); NO prod-signed token is committed (a real
// entitlement token IS the entitlement — the P0 incident class). The production bake is pinned
// NEGATIVELY: the default (baked-key) entrypoint must REJECT a dev-signed token. An absent /
// malformed / non-Bearer / forged license resolves to null (community), so the handler serves the
// free base only (TM-LIC).
import { describe, expect, test } from "bun:test";
import { devVerify, mintDevToken } from "./dev-license";
import {
  licenseEntitlementResolver,
  makeLicenseEntitlementResolver,
} from "./entitlement-filter";

// The deny-set key (ADR-0225 R-4=B) carried in the minted claims — a synthetic v4 UUID.
const LICENSE_ID = "22222222-2222-4222-8222-222222222222";

// Minted fresh per test run with the DOCUMENTED dev seed — never a committed token string.
const DEV_TOKEN = await mintDevToken({
  entitlements: ["local-ai"],
  expiry: null,
  licenseId: LICENSE_ID,
  major: 1,
  tier: "pro",
});

const reqWith = (authorization?: string): Request =>
  new Request("https://registry.caisson.sh/", {
    headers: authorization === undefined ? {} : { authorization },
  });

// The resolver under test: revocations off, dev-key verify injected through the test seam.
const resolveDev = makeLicenseEntitlementResolver(() => new Set(), devVerify);

describe("licenseEntitlementResolver (ADR-0010/0071)", () => {
  test("a valid Bearer license resolves to its signed entitlements", () => {
    expect(resolveDev(reqWith(`Bearer ${DEV_TOKEN}`))).toEqual({
      entitlements: ["local-ai"],
      updatesWindows: {},
      entitledSince: {},
    });
  });

  test("a case-insensitive bearer scheme still resolves", () => {
    expect(resolveDev(reqWith(`bearer ${DEV_TOKEN}`))).toEqual({
      entitlements: ["local-ai"],
      updatesWindows: {},
      entitledSince: {},
    });
  });

  test("no Authorization header → null (community)", () => {
    expect(resolveDev(reqWith())).toBeNull();
  });

  test("a non-Bearer scheme → null", () => {
    expect(resolveDev(reqWith("Basic abc123"))).toBeNull();
  });

  test("an empty Bearer value → null", () => {
    expect(resolveDev(reqWith("Bearer "))).toBeNull();
  });

  test("a forged / malformed token → null (verify fails safe to community)", () => {
    expect(
      resolveDev(reqWith("Bearer CAISSON-PRO-not-a-real-token")),
    ).toBeNull();
  });

  test("a windowed token's signed updatesWindows map rides along (ADR-0255)", async () => {
    const windowedToken = await mintDevToken({
      entitlements: ["local-ai"],
      expiry: null,
      licenseId: LICENSE_ID,
      major: 1,
      tier: "pro",
      updatesWindows: { "local-ai": "2027-01-01T00:00:00.000Z" },
    });
    expect(resolveDev(reqWith(`Bearer ${windowedToken}`))).toEqual({
      entitlements: ["local-ai"],
      updatesWindows: { "local-ai": "2027-01-01T00:00:00.000Z" },
      entitledSince: {},
    });
  });

  test("the DEFAULT baked-key entrypoint REJECTS a dev-signed token (the production bake happened)", () => {
    // The bake pin, proven negatively (mirrors verify.test.ts): if someone wired the dev verifier
    // into the shipped default, this dev token would resolve and this test would catch it.
    expect(
      licenseEntitlementResolver(reqWith(`Bearer ${DEV_TOKEN}`)),
    ).toBeNull();
  });
});

describe("makeLicenseEntitlementResolver — edge revocation gate (ADR-0225 R-4=B)", () => {
  test("an empty deny-set leaves a valid license unchanged", () => {
    const resolve = makeLicenseEntitlementResolver(() => new Set(), devVerify);
    expect(resolve(reqWith(`Bearer ${DEV_TOKEN}`))).toEqual({
      entitlements: ["local-ai"],
      updatesWindows: {},
      entitledSince: {},
    });
  });

  test("a REVOKED license id → null (community), exactly like a forged token", () => {
    const resolve = makeLicenseEntitlementResolver(
      () => new Set([LICENSE_ID]),
      devVerify,
    );
    expect(resolve(reqWith(`Bearer ${DEV_TOKEN}`))).toBeNull();
  });

  test("a deny-set that lists OTHER ids leaves this license unaffected", () => {
    const resolve = makeLicenseEntitlementResolver(
      () => new Set(["99999999-9999-4999-8999-999999999999"]),
      devVerify,
    );
    expect(resolve(reqWith(`Bearer ${DEV_TOKEN}`))).toEqual({
      entitlements: ["local-ai"],
      updatesWindows: {},
      entitledSince: {},
    });
  });
});
