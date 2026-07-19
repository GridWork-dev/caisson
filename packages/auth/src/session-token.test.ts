// ADR-0366: the pure HMAC-lookup-key derivation. Deterministic + keyed — the properties the
// adapter wrap in apps/site depends on.
import { describe, expect, test } from "bun:test";
import { deriveTokenLookupKey } from "./session-token.ts";

describe("deriveTokenLookupKey", () => {
  test("is deterministic for the same token + key", () => {
    const a = deriveTokenLookupKey("raw-token-1", "hmac-key-1");
    const b = deriveTokenLookupKey("raw-token-1", "hmac-key-1");
    expect(a).toBe(b);
  });

  test("is 64 lowercase hex characters (SHA-256 hex digest length)", () => {
    const key = deriveTokenLookupKey("raw-token-1", "hmac-key-1");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  test("different tokens under the same key produce different lookup keys", () => {
    const a = deriveTokenLookupKey("raw-token-1", "hmac-key-1");
    const b = deriveTokenLookupKey("raw-token-2", "hmac-key-1");
    expect(a).not.toBe(b);
  });

  test("the same token under different keys produces different lookup keys (key rotation invalidates lookups)", () => {
    const a = deriveTokenLookupKey("raw-token-1", "hmac-key-1");
    const b = deriveTokenLookupKey("raw-token-1", "hmac-key-2");
    expect(a).not.toBe(b);
  });

  test("never returns the raw token itself", () => {
    const raw = "raw-token-1";
    expect(deriveTokenLookupKey(raw, "hmac-key-1")).not.toBe(raw);
  });
});
