import { describe, expect, test } from "bun:test";
import type { TenantProofResponse } from "@/lib/tenant-evidence";
import { TenantEvidenceProxyError } from "@/lib/tenant-evidence";
import {
  createTenantProofRoute,
  type TenantProofRouteDependencies,
} from "./route.ts";

const ACCOUNT = "acct_session_only";
const OTHER_ACCOUNT = "acct_other";
const PROOF: TenantProofResponse = {
  receipt: {
    v: 1,
    seq: 0,
    hash: "a".repeat(64),
    prevHash: null,
    anchor: {
      length: 1,
      tipHash: "a".repeat(64),
      genesisHash: "a".repeat(64),
    },
    raw: {
      prevHash: null,
      payload: { email: "[REDACTED]" },
    },
    redacted: true,
    checks: {
      linkRecompute: "na",
      anchorEquality: "pass",
      signature: "na",
    },
    verifiedAt: "2026-07-25T20:00:00.000Z",
  },
  redacted: true,
  redactedPaths: ["email"],
  chainLength: 1,
};

function request(query = "?seq=0"): Request {
  return new Request(`https://caisson.sh/api/audit/proof${query}`);
}

function dependencies(
  overrides: Partial<TenantProofRouteDependencies> = {},
): TenantProofRouteDependencies {
  return {
    getSession: async () => ({
      userId: "user_01",
      accountId: ACCOUNT,
      role: "owner",
    }),
    assertTenantScope: async () => {},
    getProof: async () => PROOF,
    ...overrides,
  };
}

describe("GET /api/audit/proof", () => {
  test("requires a buyer session before any tenant or proxy read", async () => {
    let touched = false;
    const GET = createTenantProofRoute(
      dependencies({
        getSession: async () => null,
        assertTenantScope: async () => {
          touched = true;
        },
        getProof: async () => {
          touched = true;
          return PROOF;
        },
      }),
    );

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(touched).toBe(false);
  });

  test("derives the account only from the session and RLS-scopes before proxying", async () => {
    const scoped: string[] = [];
    const proxied: Array<readonly [string, number]> = [];
    const GET = createTenantProofRoute(
      dependencies({
        assertTenantScope: async (accountId) => {
          scoped.push(accountId);
        },
        getProof: async (accountId, seq) => {
          proxied.push([accountId, seq]);
          return PROOF;
        },
      }),
    );

    const response = await GET(request("?seq=0"));

    expect(response.status).toBe(200);
    expect(scoped).toEqual([ACCOUNT]);
    expect(proxied).toEqual([[ACCOUNT, 0]]);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  test("rejects a client-supplied account field because no such request field exists", async () => {
    let touched = false;
    const GET = createTenantProofRoute(
      dependencies({
        assertTenantScope: async () => {
          touched = true;
        },
      }),
    );

    const response = await GET(
      request(`?seq=0&accountId=${encodeURIComponent(OTHER_ACCOUNT)}`),
    );

    expect(response.status).toBe(400);
    expect(touched).toBe(false);
  });

  test("refuses a cross-tenant RLS scope before contacting the proxy", async () => {
    let proxied = false;
    const GET = createTenantProofRoute(
      dependencies({
        assertTenantScope: async () => {
          throw new Error("account is outside the caller's RLS scope");
        },
        getProof: async () => {
          proxied = true;
          return PROOF;
        },
      }),
    );

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(proxied).toBe(false);
    expect(await response.json()).toEqual({ error: "forbidden" });
  });

  test("returns only the already-redacted proof bytes", async () => {
    const GET = createTenantProofRoute(dependencies());

    const response = await GET(request());
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain("[REDACTED]");
    expect(text).not.toContain("secret@example.com");
  });

  test("fails closed with redaction-safe status mappings", async () => {
    const unavailable = createTenantProofRoute(
      dependencies({
        getProof: async () => {
          throw new TenantEvidenceProxyError("unavailable");
        },
      }),
    );
    const absent = createTenantProofRoute(
      dependencies({
        getProof: async () => {
          throw new TenantEvidenceProxyError("not-found");
        },
      }),
    );

    expect((await unavailable(request())).status).toBe(503);
    expect((await absent(request())).status).toBe(404);
  });

  test("preserves the explicit missing-anchor unverifiable state", async () => {
    const GET = createTenantProofRoute(
      dependencies({
        getProof: async () => ({
          state: "unverifiable",
          reason: "anchor missing",
        }),
      }),
    );

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      state: "unverifiable",
      reason: "anchor missing",
    });
  });
});
