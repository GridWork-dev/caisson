// ADR-0162 — the BYOK-aware ModelResolver. Env lanes delegate to the boot registry unchanged; a
// per-tenant lane pulls the caller's key via the injected port, builds a provider, and caches the built
// client (TTL) so a repeat resolve skips the port. Error paths are fail-closed. No live model call.
import { describe, expect, test } from "bun:test";
import { parseAiSettings } from "@caisson-sh/ai-config";
import {
  buildByokResolver,
  laneKeySource,
  type TenantKeyResolver,
} from "./byok-resolver.ts";

const settings = parseAiSettings({
  defaultLane: "env",
  lanes: {
    env: { provider: "openai", model: "gpt-4o", apiKeyEnv: "OPENAI_KEY" },
    byok: { provider: "openai", model: "gpt-4o", keySource: "tenant" },
    byokBedrock: {
      provider: "bedrock",
      model: "anthropic.claude",
      keySource: "tenant",
    },
  },
});

describe("buildByokResolver (ADR-0162)", () => {
  test("an env-pointer lane resolves through the boot registry (unchanged path)", async () => {
    const resolve = buildByokResolver({ settings });
    const model = await resolve("env");
    expect(model).toBeDefined();
    expect(typeof model.doGenerate).toBe("function");
  });

  test("a per-tenant lane pulls the tenant key and builds a provider", async () => {
    const calls: Array<[string, string]> = [];
    const resolveTenantKey: TenantKeyResolver = async (accountId, provider) => {
      calls.push([accountId, provider]);
      return "sk-tenant-key";
    };
    const resolve = buildByokResolver({ settings, resolveTenantKey });
    const model = await resolve("byok", "acct_1");
    expect(model).toBeDefined();
    expect(typeof model.doGenerate).toBe("function");
    expect(calls).toEqual([["acct_1", "openai"]]);
  });

  test("the built client is cached per (account, provider) within the TTL", async () => {
    let nowMs = 1_000;
    let hits = 0;
    const resolveTenantKey: TenantKeyResolver = async () => {
      hits += 1;
      return "sk-tenant-key";
    };
    const resolve = buildByokResolver({
      settings,
      resolveTenantKey,
      now: () => nowMs,
      cacheTtlMs: 10_000,
    });
    await resolve("byok", "acct_1");
    await resolve("byok", "acct_1"); // within TTL → cache hit, port NOT called again
    expect(hits).toBe(1);
    nowMs += 20_000; // past TTL → rebuilt
    await resolve("byok", "acct_1");
    expect(hits).toBe(2);
    // A different account is a distinct cache entry.
    await resolve("byok", "acct_2");
    expect(hits).toBe(3);
  });

  test("a per-tenant lane without an accountId is refused", async () => {
    const resolve = buildByokResolver({
      settings,
      resolveTenantKey: async () => "k",
    });
    await expect(resolve("byok")).rejects.toThrow(/accountId/);
  });

  test("a per-tenant lane without a resolveTenantKey port is refused", async () => {
    const resolve = buildByokResolver({ settings });
    await expect(resolve("byok", "acct_1")).rejects.toThrow(/resolveTenantKey/);
  });

  test("no stored key for the tenant is refused (fail-closed)", async () => {
    const resolve = buildByokResolver({
      settings,
      resolveTenantKey: async () => undefined,
    });
    await expect(resolve("byok", "acct_1")).rejects.toThrow(
      /no BYOK provider key/,
    );
  });

  test("bedrock is rejected for per-tenant BYOK (multi-part credential)", async () => {
    const resolve = buildByokResolver({
      settings,
      resolveTenantKey: async () => "k",
    });
    await expect(resolve("byokBedrock", "acct_1")).rejects.toThrow(/bedrock/);
  });
});

describe("laneKeySource (ADR-0182 pricebook discriminator)", () => {
  test("an env-pointer lane resolves to 'env'", () => {
    expect(laneKeySource(settings, "env")).toBe("env");
  });

  test("a per-tenant (BYOK) lane resolves to 'tenant'", () => {
    expect(laneKeySource(settings, "byok")).toBe("tenant");
  });
});
