import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson-sh/testing";
import { TENANT_KEY_BYTES, deriveInfo, deriveTenantKey } from "./derive.ts";

// Fixed, non-secret test vectors (NOT real keys) — deterministic KAT inputs.
const MASTER = Buffer.alloc(32, 0x11);
const SALT = Buffer.alloc(32, 0x22);

describe("deriveTenantKey (HKDF-SHA256, ADR-0043)", () => {
  test("the info string is EXACTLY the ADR-0043 format", () => {
    expect(deriveInfo(1, "tenant_a")).toBe("caisson-field-crypto:v1:tenant_a");
    expect(deriveInfo(7, "acct-xyz")).toBe("caisson-field-crypto:v7:acct-xyz");
  });

  test("derives a 32-byte key, deterministically", () => {
    const k1 = deriveTenantKey(MASTER, SALT, 1, "tenant_a");
    const k2 = deriveTenantKey(MASTER, SALT, 1, "tenant_a");
    expect(k1.length).toBe(TENANT_KEY_BYTES);
    expect(k1.toString("hex")).toBe(k2.toString("hex"));
  });

  test("distinct tenants get distinct keys (per-tenant isolation)", () => {
    const a = deriveTenantKey(MASTER, SALT, 1, "tenant_a");
    const b = deriveTenantKey(MASTER, SALT, 1, "tenant_b");
    expect(a.toString("hex")).not.toBe(b.toString("hex"));
  });

  test("distinct key versions get distinct keys (rotation)", () => {
    const v1 = deriveTenantKey(MASTER, SALT, 1, "tenant_a");
    const v2 = deriveTenantKey(MASTER, SALT, 2, "tenant_a");
    expect(v1.toString("hex")).not.toBe(v2.toString("hex"));
  });

  test("rejects a wrong-length master key / salt and bad key versions", () => {
    expect(() => deriveTenantKey(Buffer.alloc(16), SALT, 1, "t")).toThrow();
    expect(() => deriveTenantKey(MASTER, Buffer.alloc(16), 1, "t")).toThrow();
    expect(() => deriveTenantKey(MASTER, SALT, 0, "t")).toThrow();
    expect(() => deriveTenantKey(MASTER, SALT, 1, "")).toThrow();
  });

  test("known-answer regression (golden) for fixed vectors", () => {
    matchGolden(import.meta.url, "derive-kat", {
      "v1/tenant_a": deriveTenantKey(MASTER, SALT, 1, "tenant_a").toString(
        "hex",
      ),
      "v2/tenant_a": deriveTenantKey(MASTER, SALT, 2, "tenant_a").toString(
        "hex",
      ),
      "v1/tenant_b": deriveTenantKey(MASTER, SALT, 1, "tenant_b").toString(
        "hex",
      ),
    });
  });
});
