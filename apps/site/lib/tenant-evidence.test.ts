import { createHmac } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { parseEvidencePackManifest } from "@caisson/compliance-core";
import type { fetchWithTimeout } from "@caisson/kernel";
import {
  createTenantEvidenceProxy,
  mapBuyerCrosswalk,
  parseTenantEvidenceProxyConfig,
  TenantEvidenceProxyError,
} from "./tenant-evidence.ts";
import {
  assertTenantEvidenceScope,
  TenantScopeError,
} from "./tenant-evidence-runtime.ts";

const SECRET = "tenant-evidence-proxy-secret-at-least-32-bytes";
const ACCOUNT = "acct_buyer_01";
const PROOF = {
  receipt: {
    v: 1,
    seq: 4,
    hash: "a".repeat(64),
    prevHash: "b".repeat(64),
    anchor: {
      length: 5,
      tipHash: "a".repeat(64),
      genesisHash: "c".repeat(64),
    },
    raw: {
      prevHash: "b".repeat(64),
      payload: { token: "[REDACTED]" },
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
  redactedPaths: ["token"],
  chainLength: 5,
} as const;

function realManifest() {
  return parseEvidencePackManifest({
    formatVersion: "2",
    tenantId: ACCOUNT,
    framework: {
      id: "soc2-tsc",
      title: "SOC 2 Trust Services Criteria",
      version: "2024.1",
    },
    chainAnchor: {
      length: 5,
      tipHash: "a".repeat(64),
      genesisHash: "c".repeat(64),
    },
    controls: [
      {
        controlId: "AUDIT.IMMUTABLE-LOG",
        title: "Immutable audit log",
        family: "Audit",
        statement: "Audit rows are anchored in write-once storage.",
        crosswalk: [],
        evidence: [
          {
            collectorId: "substrate.audit-chain-integrity",
            title: "Audit chain integrity",
            summary: "The chain matched its persisted anchor.",
            status: "pass",
            facts: { valid: true },
            manualSlots: [],
          },
        ],
        readiness: "ready",
      },
    ],
    summary: {
      totalControls: 1,
      controlsReady: 1,
      controlsWithGaps: 0,
      totalEvidenceItems: 1,
      posture: "1 control is evidence-ready.",
    },
    crosswalkRollup: {
      cells: [
        {
          framework: "HIPAA-Security",
          reference: "164.312(b)",
          canonicalControlIds: ["AUDIT.IMMUTABLE-LOG"],
          status: "ready",
          claim: "maps-to",
          evidencePointers: ["AUDIT.IMMUTABLE-LOG"],
        },
        {
          framework: "SOC2-TSC",
          reference: "CC7.2",
          canonicalControlIds: ["AUDIT.IMMUTABLE-LOG"],
          status: "ready",
          claim: "implements",
          evidencePointers: ["AUDIT.IMMUTABLE-LOG"],
        },
      ],
    },
  });
}

describe("tenant evidence internal proxy client", () => {
  test("sends a proof request without an account body field and binds the credential to the session account", async () => {
    let seen: Request | undefined;
    const fetchImpl = (async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      seen = new Request(input, init);
      return Response.json(PROOF);
    }) as typeof fetchWithTimeout;
    const proxy = createTenantEvidenceProxy(
      parseTenantEvidenceProxyConfig({
        url: "https://admin.railway.internal/api/internal/audit/proof",
        internalHost: "admin.railway.internal",
        secret: SECRET,
      }),
      fetchImpl,
    );

    const result = await proxy.getProof(ACCOUNT, 4);

    expect(result).toEqual(PROOF);
    expect(await seen?.json()).toEqual({ seq: 4 });
    expect(seen?.headers.get("x-caisson-account-id")).toBe(ACCOUNT);
    expect(seen?.headers.get("authorization")).toBe(
      `Bearer ${createHmac("sha256", SECRET).update(ACCOUNT).digest("hex")}`,
    );
  });

  test("rejects unsafe URLs and unknown config fields at the strict boundary", () => {
    expect(() =>
      parseTenantEvidenceProxyConfig({
        url: "http://admin.railway.internal/api/internal/audit/proof",
        internalHost: "admin.railway.internal",
        secret: SECRET,
      }),
    ).toThrow();
    expect(() =>
      parseTenantEvidenceProxyConfig({
        url: "https://admin.railway.internal/api/internal/audit/proof",
        internalHost: "admin.railway.internal",
        secret: SECRET,
        accountId: ACCOUNT,
      }),
    ).toThrow();
    expect(() =>
      parseTenantEvidenceProxyConfig({
        url: "https://admin.caisson.sh/api/internal/audit/proof",
        internalHost: "admin.railway.internal",
        secret: SECRET,
      }),
    ).toThrow();
  });

  test("fails closed when the proof proxy returns an unknown field", async () => {
    const fetchImpl = (async () =>
      Response.json({
        ...PROOF,
        accountId: ACCOUNT,
      })) as typeof fetchWithTimeout;
    const proxy = createTenantEvidenceProxy(
      parseTenantEvidenceProxyConfig({
        url: "https://admin.railway.internal/api/internal/audit/proof",
        internalHost: "admin.railway.internal",
        secret: SECRET,
      }),
      fetchImpl,
    );

    await expect(proxy.getProof(ACCOUNT, 4)).rejects.toEqual(
      new TenantEvidenceProxyError("unavailable"),
    );
  });

  test("reads and validates the persisted latest real evidence pack through the same proxy seam", async () => {
    const manifest = realManifest();
    let body: unknown;
    const fetchImpl = (async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      body = JSON.parse(String(init?.body)) as unknown;
      return Response.json({
        kind: "latest-evidence-pack",
        sha256: "d".repeat(64),
        manifestSha256: "e".repeat(64),
        generatedAt: "2026-07-25T20:30:00.000Z",
        manifest,
      });
    }) as typeof fetchWithTimeout;
    const proxy = createTenantEvidenceProxy(
      parseTenantEvidenceProxyConfig({
        url: "https://admin.railway.internal/api/internal/audit/proof",
        internalHost: "admin.railway.internal",
        secret: SECRET,
      }),
      fetchImpl,
    );

    const pack = await proxy.getLatestEvidencePack(ACCOUNT);

    expect(body).toEqual({ kind: "latest-evidence-pack" });
    expect(pack.manifest).toEqual(manifest);
    expect(pack.sha256).toBe("d".repeat(64));
  });
});

describe("buyer crosswalk mapper", () => {
  test("maps a real evidence-pack manifest into separately labeled edge kinds without an aggregate", () => {
    const mapped = mapBuyerCrosswalk(realManifest());

    expect(mapped.mapsTo).toEqual([
      expect.objectContaining({
        claim: "maps-to",
        framework: "HIPAA-Security",
        reference: "164.312(b)",
      }),
    ]);
    expect(mapped.implements).toEqual([
      expect.objectContaining({
        claim: "implements",
        framework: "SOC2-TSC",
        reference: "CC7.2",
      }),
    ]);
    expect(Object.keys(mapped).sort()).toEqual(["implements", "mapsTo"]);
    expect(JSON.stringify(mapped)).not.toContain("coverage");
  });
});

describe("tenant evidence RLS scope guard", () => {
  test("accepts only the account actually bound by the scoped transaction", async () => {
    await expect(
      assertTenantEvidenceScope(ACCOUNT, async (accountId) => accountId),
    ).resolves.toBeUndefined();
    await expect(
      assertTenantEvidenceScope(ACCOUNT, async () => "acct_other"),
    ).rejects.toBeInstanceOf(TenantScopeError);
    await expect(
      assertTenantEvidenceScope(ACCOUNT, async () => null),
    ).rejects.toBeInstanceOf(TenantScopeError);
  });
});
