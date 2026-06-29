// licenseEntitlementResolver — the Worker's offline license → purchased-ids path (ADR-0010/0047/0071).
// Drives the REAL @caisson/license-verify Ed25519 verifier with the committed KAT token (the same
// known-answer vector license-verify pins; entitlements ["local-ai"], tier pro, non-expiring), proving
// the verify→entitlements seam end to end. An absent / malformed / non-Bearer / forged license resolves
// to null (community), so the handler serves the free base only — fail-safe-to-community (TM-LIC).
import { describe, expect, test } from "bun:test";
import { licenseEntitlementResolver } from "./entitlement-filter";

// The deterministic KAT license token (license-verify/src/token.test.ts) — a TEST vector, never a
// production secret. Carries the signed claims { entitlements: ["local-ai"], tier: "pro", expiry: null }.
const KAT_TOKEN =
  "CAISSON-PRO-eyJlbnRpdGxlbWVudHMiOlsibG9jYWwtYWkiXSwiZXhwaXJ5IjpudWxsLCJsaWNlbnNlSWQiOiJmNDdhYzEwYi01OGNjLTQzNzItYTU2Ny0wZTAyYjJjM2Q0NzkiLCJtYWpvciI6MSwidGllciI6InBybyJ9mLtVqk-91jkIh6xD8M0BPmwVbwZfFtH9A0hnBM7zNgI6C1BHuiZEdyBYBtj2dftdSQRNPX9RnIjV21FDEfgdBQ";

const reqWith = (authorization?: string): Request =>
  new Request("https://registry.caisson.sh/", {
    headers: authorization === undefined ? {} : { authorization },
  });

describe("licenseEntitlementResolver (ADR-0010/0071)", () => {
  test("a valid Bearer license resolves to its signed entitlements", () => {
    expect(licenseEntitlementResolver(reqWith(`Bearer ${KAT_TOKEN}`))).toEqual([
      "local-ai",
    ]);
  });

  test("a case-insensitive bearer scheme still resolves", () => {
    expect(licenseEntitlementResolver(reqWith(`bearer ${KAT_TOKEN}`))).toEqual([
      "local-ai",
    ]);
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
