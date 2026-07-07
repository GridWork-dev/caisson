import { describe, expect, test } from "bun:test";

import {
  DEFAULT_REDACT_KEYS,
  REDACTED,
  isRedactedKey,
  redactValue,
} from "./redact";

describe("isRedactedKey", () => {
  test("matches case-insensitively", () => {
    expect(isRedactedKey("Authorization", DEFAULT_REDACT_KEYS)).toBe(true);
    expect(isRedactedKey("email", DEFAULT_REDACT_KEYS)).toBe(false);
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
});
