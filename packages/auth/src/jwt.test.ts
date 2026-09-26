import { describe, expect, test } from "bun:test";
import { AuthnError } from "@caisson-sh/kernel";
import {
  generateAccountKeyPair,
  requireSession,
  signAccountJwt,
  verifyAccountJwt,
} from "./index.ts";

const keys = generateAccountKeyPair();
const claims = { userId: "usr_1", accountId: "acct_a", role: "owner" as const };

describe("EdDSA account JWT", () => {
  test("sign → verify round-trips the session", () => {
    const token = signAccountJwt(claims, keys.privateKey);
    expect(verifyAccountJwt(token, keys.publicKey)).toEqual(claims);
  });

  test("a tampered payload is rejected", () => {
    const token = signAccountJwt(claims, keys.privateKey);
    const [h, , s] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({
        sub: "usr_1",
        account_id: "acct_b",
        role: "owner",
        exp: 9_999_999_999,
      }),
    ).toString("base64url");
    expect(() =>
      verifyAccountJwt(`${h}.${forged}.${s}`, keys.publicKey),
    ).toThrow(AuthnError);
  });

  test("a token signed by a different key is rejected", () => {
    const other = generateAccountKeyPair();
    const token = signAccountJwt(claims, other.privateKey);
    expect(() => verifyAccountJwt(token, keys.publicKey)).toThrow(AuthnError);
  });

  test("an expired token is rejected", () => {
    const token = signAccountJwt(claims, keys.privateKey, {
      ttlSeconds: 60,
      now: 1_000,
    });
    expect(() =>
      verifyAccountJwt(token, keys.publicKey, { now: 2_000 }),
    ).toThrow(AuthnError);
  });

  test("every failure mode yields the same generic client message (no oracle)", () => {
    const captureMessage = (fn: () => unknown): string => {
      try {
        fn();
      } catch (err) {
        return err instanceof AuthnError ? err.message : `unexpected: ${err}`;
      }
      return "did not throw";
    };

    const malformed = captureMessage(() =>
      verifyAccountJwt("not-a-jwt", keys.publicKey),
    );
    const badSignature = captureMessage(() => {
      const other = generateAccountKeyPair();
      const token = signAccountJwt(claims, other.privateKey);
      return verifyAccountJwt(token, keys.publicKey);
    });
    const expired = captureMessage(() => {
      const token = signAccountJwt(claims, keys.privateKey, {
        ttlSeconds: 60,
        now: 1_000,
      });
      return verifyAccountJwt(token, keys.publicKey, { now: 2_000 });
    });

    expect(malformed).toBe("Invalid token");
    expect(badSignature).toBe(malformed);
    expect(expired).toBe(malformed);
  });

  test("requireSession guards a null context", () => {
    expect(() => requireSession(null)).toThrow(AuthnError);
    expect(requireSession(claims)).toEqual(claims);
  });
});
