// ADR-0112: the served composition (this reference app) wires the per-account MCP rate-limit hook
// BY DEFAULT, so an embedding buyer gets abuse throttling with zero extra wiring. There is NO
// first-party served MCP instance in this repo — the buyer MCP ships for buyers to embed (the base
// mcp-server is the transport-agnostic core; this `createBaseApp` is the canonical wiring) — so the
// strongest available fix is making the default wiring fire here. These tests prove the DEFAULT path
// actually reaches the rate-limit store, blocks on a deny, fails OPEN on a store fault, and yields to
// a caller-supplied override. They use a fake Transactor (no PGlite) so they are fast and flake-free.
import { describe, expect, test } from "bun:test";
import { RateLimitError } from "@caisson/kernel";
import type { Transactor, TenantExecutor } from "@caisson/tenancy-rls";
import { createStripeBilling } from "@caisson/billing-orchestration";
import { loadRegistryIndex } from "@caisson/registry";
import type { McpServerOptions, RateLimitHook } from "@caisson/mcp-server";
import { createBaseApp } from "./app.ts";

const TOKEN = "mcp_tok_acct_a_000000";
const ACCOUNT = "acct_a";
const EMPTY_INDEX = loadRegistryIndex({ schemaVersion: 1, modules: [] });

// Billing is unused by the MCP read path; a real provider keeps the types honest.
const billing = createStripeBilling({
  webhookSecret: "whsec_test",
  apiKey: "sk_test",
});

const mcpOptions = (extra?: Partial<McpServerOptions>): McpServerOptions => ({
  tokens: [{ token: TOKEN, accountId: ACCOUNT, entitlements: ["compliance"] }],
  index: EMPTY_INDEX,
  onGenerate: async () => ({ generationId: "gen_x" }),
  ...extra,
});

// A fake Transactor mimicking the rate_limit token-bucket store via SQL-keyword matching: `allow`
// returns a consumed token, `deny` returns an empty bucket (the UPDATE matches 0 rows), `throw`
// simulates an unreachable store. `onTransaction` records that the store was reached at all.
type StoreMode = "allow" | "deny" | "throw";
function fakeStore(mode: StoreMode, onTransaction?: () => void): Transactor {
  return {
    async transaction<T>(fn: (tx: TenantExecutor) => Promise<T>): Promise<T> {
      onTransaction?.();
      if (mode === "throw") throw new Error("rate_limit store unreachable");
      const tx: TenantExecutor = {
        async query<R = Record<string, unknown>>(
          sql: string,
        ): Promise<{ rows: R[] }> {
          let rows: unknown[] = [];
          if (sql.includes("UPDATE rate_limit")) {
            rows = mode === "allow" ? [{ tokens: 119 }] : [];
          } else if (sql.includes("SELECT last_refill_ms")) {
            rows = [{ last_refill_ms: 0, refill_interval_ms: 60_000 }];
          } else if (sql.includes("FROM pg_roles")) {
            // The withTenant role pre-flight (fail-closed): answer as an unprivileged role.
            rows = [{ rolsuper: false, rolbypassrls: false }];
          }
          return { rows: rows as R[] };
        },
        async exec(): Promise<unknown> {
          return undefined;
        },
      };
      return fn(tx);
    },
  };
}

describe("createBaseApp default MCP rate-limit wiring (ADR-0112)", () => {
  test("default path reaches the throttle store and allows under budget", async () => {
    let reached = false;
    const app = createBaseApp({
      db: fakeStore("allow", () => {
        reached = true;
      }),
      billing,
      mcp: mcpOptions(),
    });

    const result = await app.mcpQuery(TOKEN, "list_modules", {});

    // The store was reached inside withTenant (proves the hook was wired by default, not skipped)…
    expect(reached).toBe(true);
    // …and the tool still answered (a token was available).
    expect(result).toEqual({ modules: ["compliance"] });
  });

  test("default path BLOCKS with RateLimitError when the bucket is empty", async () => {
    const app = createBaseApp({
      db: fakeStore("deny"),
      billing,
      mcp: mcpOptions(),
    });

    await expect(
      app.mcpQuery(TOKEN, "list_modules", {}),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  test("default path FAILS OPEN on a store fault and alerts onRateLimitStoreError", async () => {
    let alerted: { err: unknown; accountId: string } | null = null;
    const app = createBaseApp({
      db: fakeStore("throw"),
      billing,
      mcp: mcpOptions(),
      onRateLimitStoreError: (err, accountId) => {
        alerted = { err, accountId };
      },
    });

    // Fail-OPEN (lock 5): a store fault must NOT lock out a paying buyer.
    const result = await app.mcpQuery(TOKEN, "list_modules", {});
    expect(result).toEqual({ modules: ["compliance"] });
    // The fault was surfaced to the telemetry sink, not swallowed.
    expect(alerted).not.toBeNull();
    expect(alerted!.accountId).toBe(ACCOUNT);
  });

  test("a caller-supplied checkRateLimit overrides the default (store untouched)", async () => {
    let storeReached = false;
    let overrideCalls = 0;
    const override: RateLimitHook = async () => {
      overrideCalls += 1;
    };
    const app = createBaseApp({
      db: fakeStore("deny", () => {
        storeReached = true;
      }),
      billing,
      mcp: mcpOptions({ checkRateLimit: override }),
    });

    const result = await app.mcpQuery(TOKEN, "list_modules", {});

    expect(result).toEqual({ modules: ["compliance"] });
    expect(overrideCalls).toBe(1);
    // The default services/license store was never constructed/reached.
    expect(storeReached).toBe(false);
  });
});
