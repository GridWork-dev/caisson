// licenseEntitlementResolver — the Worker's offline license → purchased-ids path (ADR-0010/0047/0071).
// Drives the REAL @caisson/license-verify Ed25519 verifier with a PRODUCTION-signed token (the verifier
// bakes the production public key, ADR-0110; entitlements ["local-ai"], tier pro, non-expiring), proving
// the verify→entitlements seam end to end against the SHIPPED key. An absent / malformed / non-Bearer /
// forged license resolves to null (community), so the handler serves the free base only (TM-LIC).
import { describe, expect, test } from "bun:test";
import { licenseEntitlementResolver } from "./entitlement-filter";

// A real PRODUCTION-signed license token (minted offline with CAISSON_LICENSE_SIGNING_KEY; a token is
// public-safe — its detached signature reveals nothing about the private key). Keep in sync with the
// baked key in license-verify/src/verify.ts. Signed claims { entitlements: ["local-ai"], tier "pro",
// expiry null }.
const PROD_TOKEN =
  "CAISSON-PRO-eyJlbnRpdGxlbWVudHMiOlsibG9jYWwtYWkiXSwiZXhwaXJ5IjpudWxsLCJsaWNlbnNlSWQiOiIyMjIyMjIyMi0yMjIyLTQyMjItODIyMi0yMjIyMjIyMjIyMjIiLCJtYWpvciI6MSwidGllciI6InBybyJ9JCCq8unU9ASs7NpgsOQSFpKl6Bti7J41yCKbLV8-1q0HbeUzZ-K7cfdaBge2_gyn38fKvEomzkH35GRQ0RbFBA";

const reqWith = (authorization?: string): Request =>
  new Request("https://registry.caisson.sh/", {
    headers: authorization === undefined ? {} : { authorization },
  });

describe("licenseEntitlementResolver (ADR-0010/0071)", () => {
  test("a valid Bearer license resolves to its signed entitlements", () => {
    expect(licenseEntitlementResolver(reqWith(`Bearer ${PROD_TOKEN}`))).toEqual(
      ["local-ai"],
    );
  });

  test("a case-insensitive bearer scheme still resolves", () => {
    expect(licenseEntitlementResolver(reqWith(`bearer ${PROD_TOKEN}`))).toEqual(
      ["local-ai"],
    );
  });

  test("no Authorization header → null (community)", () => {
    expect(licenseEntitlementResolver(reqWith())).toBeNull();
  });

  test("a non-Bearer scheme → null", () => {
    expect(licenseEntitlementResolver(reqWith("Basic abc123"))).toBeNull();
  });

  test("an empty Bearer value → null", () => {
    expect(licenseEntitlementResolver(reqWith("Bearer "))).toBeNull();
  });

  test("a forged / malformed token → null (verify fails safe to community)", () => {
    expect(
      licenseEntitlementResolver(
        reqWith("Bearer CAISSON-PRO-not-a-real-token"),
      ),
    ).toBeNull();
  });
});
