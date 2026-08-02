import { describe, expect, test } from "bun:test";
import { parseEvidencePackManifest } from "@caisson/compliance-core";
import {
  loadDashboardEvidencePage,
  type DashboardEvidenceDependencies,
} from "./page.tsx";

const ACCOUNT = "acct_session_only";

// A minimal but real manifest (same shape lib/tenant-evidence.test.ts's realManifest() builds) so
// the fixture matches `LatestEvidencePackResponse` instead of a stale ad hoc shape.
function fixtureManifest() {
  return parseEvidencePackManifest({
    formatVersion: "2",
    tenantId: ACCOUNT,
    framework: {
      id: "soc2-tsc",
      title: "SOC 2 Trust Services Criteria",
      version: "2024.1",
    },
    chainAnchor: {
      length: 0,
      tipHash: "a".repeat(64),
      genesisHash: "c".repeat(64),
    },
    controls: [],
    summary: {
      totalControls: 0,
      controlsReady: 0,
      controlsWithGaps: 0,
      totalEvidenceItems: 0,
      posture: "No controls evaluated.",
    },
    crosswalkRollup: { cells: [] },
  });
}

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
        kind: "latest-evidence-pack",
        sha256: "d".repeat(64),
        manifestSha256: "e".repeat(64),
        generatedAt: "2026-07-25T20:00:00.000Z",
        manifest: fixtureManifest(),
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
