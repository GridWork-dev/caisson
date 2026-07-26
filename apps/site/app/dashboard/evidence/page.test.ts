import { describe, expect, test } from "bun:test";
import {
  loadDashboardEvidencePage,
  type DashboardEvidenceDependencies,
} from "./page.tsx";

const ACCOUNT = "acct_session_only";

function dependencies(
  overrides: Partial<DashboardEvidenceDependencies> = {},
): DashboardEvidenceDependencies {
  return {
    getSession: async () => ({
      userId: "user_01",
      accountId: ACCOUNT,
      role: "owner",
    }),
    checkRateLimit: () => ({ allowed: true, retryAfterSec: 0 }),
    assertTenantScope: async () => {},
    getProxy: () => ({
      getLatestEvidencePack: async () => ({
        pack: {
          v: 1,
          tenantId: ACCOUNT,
          generatedAt: "2026-07-25T20:00:00.000Z",
          chain: { valid: true, brokenAt: null },
          rows: [],
        },
        chainLength: 0,
      }),
      getProof: async () => ({
        state: "unverifiable",
        reason: "anchor missing",
      }),
    }),
    ...overrides,
  };
}

describe("/dashboard/evidence live page loader", () => {
  test("checks the session account budget before RLS or proxy reads", async () => {
    const order: string[] = [];
    const result = await loadDashboardEvidencePage(
      Promise.resolve({}),
      dependencies({
        getSession: async () => {
          order.push("session");
          return {
            userId: "user_01",
            accountId: ACCOUNT,
            role: "owner",
          };
        },
        checkRateLimit: (accountId) => {
          order.push(`rate:${accountId}`);
          return { allowed: false, retryAfterSec: 17 };
        },
        assertTenantScope: async () => {
          order.push("scope");
        },
        getProxy: () => {
          order.push("proxy");
          throw new Error("must not run");
        },
      }),
    );

    expect(order).toEqual(["session", `rate:${ACCOUNT}`]);
    expect(result.proofError).toMatch(/rate limited/i);
    expect(result.latestPackError).toMatch(/rate limited/i);
  });
});
