// Proves the documented @caisson/rate-limit → @caisson/mcp-server composition: the hook reaches the
// store, blocks on a deny, fails OPEN on a store fault, and yields to a caller-supplied override.
// A fake Transactor keeps the package-seam proof fast and flake-free.
import { describe, expect, test } from "bun:test";
import { RateLimitError } from "@caisson/kernel";
import type { Transactor, TenantExecutor } from "@caisson/tenancy-rls";
import { loadRegistryIndex } from "@caisson/registry-schema";
import {
  type McpServer,
  type McpServerOptions,
  type RateLimitHook,
} from "@caisson/mcp-server";
import { createRateLimitedMcpServer } from "./account-hook.ts";

const TOKEN = "mcp_tok_acct_a_000000000000000000";
const ACCOUNT = "acct_a";
const EMPTY_INDEX = loadRegistryIndex({ schemaVersion: 1, modules: [] });

const mcpOptions = (extra?: Partial<McpServerOptions>): McpServerOptions => ({
  tokens: [{ token: TOKEN, accountId: ACCOUNT }],
  index: EMPTY_INDEX,
  onGenerate: async () => ({ generationId: "gen_x" }),
  ...extra,
});

function createRateLimitedServer(
  db: Transactor,
  extra?: Partial<McpServerOptions>,
  onStoreError?: (err: unknown, accountId: string) => void,
): McpServer {
  return createRateLimitedMcpServer(mcpOptions(extra), {
    db,
    ...(onStoreError !== undefined ? { onStoreError } : {}),
  });
}

/** An allowed call returns the (empty) catalog listing; a denied one throws before the handler. */
async function listModules(server: McpServer): Promise<unknown> {
  const session = server.authenticate(TOKEN);
  return server.handleToolCall(session, "list_modules", {});
}

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

describe("MCP rate-limit wiring", () => {
  test("default path reaches the throttle store and allows under budget", async () => {
    let reached = false;
    const server = createRateLimitedServer(
      fakeStore("allow", () => {
        reached = true;
      }),
    );

    const result = await listModules(server);

    // The store was reached inside withTenant (proves the hook was wired by default, not skipped)…
    expect(reached).toBe(true);
    // …and the tool still answered (a token was available).
    expect(result).toEqual({ modules: [] });
  });

  test("default path BLOCKS with RateLimitError when the bucket is empty", async () => {
    const server = createRateLimitedServer(fakeStore("deny"));

    await expect(listModules(server)).rejects.toBeInstanceOf(RateLimitError);
  });

  test("default path FAILS OPEN on a store fault and alerts onRateLimitStoreError", async () => {
    let alerted: { err: unknown; accountId: string } | null = null;
    const server = createRateLimitedServer(
      fakeStore("throw"),
      undefined,
      (err, accountId) => {
        alerted = { err, accountId };
      },
    );

    // Fail-OPEN (lock 5): a store fault must NOT lock out a paying buyer.
    const result = await listModules(server);
    expect(result).toEqual({ modules: [] });
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
    const server = createRateLimitedServer(
      fakeStore("deny", () => {
        storeReached = true;
      }),
      { checkRateLimit: override },
    );

    const result = await listModules(server);

    expect(result).toEqual({ modules: [] });
    expect(overrideCalls).toBe(1);
    // The rate-limit store was never constructed/reached.
    expect(storeReached).toBe(false);
  });
});
