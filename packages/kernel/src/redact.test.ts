import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DEFAULT_REDACT_KEYS,
  REDACTED,
  isRedactedKey,
  redactValue,
} from "./redact.ts";

describe("isRedactedKey", () => {
  test("matches case-insensitively", () => {
    expect(isRedactedKey("Authorization", DEFAULT_REDACT_KEYS)).toBe(true);
    expect(isRedactedKey("email", DEFAULT_REDACT_KEYS)).toBe(false);
  });

  test("normalizes compound credential names across camel, snake, and kebab case", () => {
    for (const key of [
      "access_token",
      "accessToken",
      "ACCESS-TOKEN",
      "refresh_token",
      "refreshToken",
      "session_token",
      "sessionToken",
      "client-secret",
    ]) {
      expect(isRedactedKey(key, DEFAULT_REDACT_KEYS)).toBe(true);
    }
  });

  test("redacts credential-name segments inside display-only compound keys", () => {
    for (const key of [
      "serviceCredentials",
      "api_credentials",
      "someAccessToken",
      "setCookieHeader",
      "clientAssertionJwt",
    ]) {
      expect(isRedactedKey(key, DEFAULT_REDACT_KEYS)).toBe(true);
      expect(
        JSON.stringify(redactValue({ [key]: "hunter2" }, DEFAULT_REDACT_KEYS)),
      ).not.toContain("hunter2");
    }
    expect(isRedactedKey("monkey", DEFAULT_REDACT_KEYS)).toBe(false);
  });

  test.each([
    "credential",
    "credentials",
    "auth",
    "clientAssertion",
    "setCookie",
  ])("treats opaque values under %s as secret-bearing", (key) => {
    expect(isRedactedKey(key, DEFAULT_REDACT_KEYS)).toBe(true);
    expect(
      JSON.stringify(redactValue({ [key]: "hunter2" }, DEFAULT_REDACT_KEYS)),
    ).not.toContain("hunter2");
  });
});

describe("redactValue", () => {
  test("masks secret keys anywhere in the tree, leaves others intact", () => {
    const input = {
      id: "u1",
      token: "sk_live_secret",
      profile: { email: "a@b.co", password: "hunter2" },
      keys: [{ apiKey: "k1" }, { note: "ok" }],
    };
    expect(redactValue(input, DEFAULT_REDACT_KEYS)).toEqual({
      id: "u1",
      token: REDACTED,
      profile: { email: "a@b.co", password: REDACTED },
      keys: [{ apiKey: REDACTED }, { note: "ok" }],
    });
  });

  test("passes primitives and non-redacted structures through unchanged", () => {
    expect(redactValue(42, DEFAULT_REDACT_KEYS)).toBe(42);
    expect(redactValue([1, 2, 3], DEFAULT_REDACT_KEYS)).toEqual([1, 2, 3]);
    expect(redactValue(null, DEFAULT_REDACT_KEYS)).toBeNull();
  });

  test("a custom key set redacts exactly those keys", () => {
    expect(redactValue({ ssn: "x", name: "y" }, new Set(["ssn"]))).toEqual({
      ssn: REDACTED,
      name: "y",
    });
  });

  test("scrubs credential spans nested under otherwise-benign keys", () => {
    expect(
      redactValue(
        {
          note: "rotate sk-proj-AAAABBBBCCCCDDDD before release",
          nested: ["auth_token: ghp_0123456789ABCDEFabcdef0123"],
        },
        DEFAULT_REDACT_KEYS,
      ),
    ).toEqual({
      note: "rotate [REDACTED] before release",
      nested: ["auth_token: [REDACTED]"],
    });
  });
});

describe("redact is node-free (server + browser + offline verifier share it)", () => {
  test("the module imports zero node: specifiers", () => {
    const src = readFileSync(new URL("./redact.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/from\s+["']node:/);
  });
});
