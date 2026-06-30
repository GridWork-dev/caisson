// The license-issuer HTTP surface end to end (ADR-0108): POST /issue resolves an account's entitlements
// over PGlite + real `withTenant` RLS, signs them via @caisson/license-issue, and the returned token
// verifies under the SHIPPED @caisson/license-verify `verifyLicense`. The signer uses the deterministic
// KAT seed — SHA-256("caisson-license-verify-KAT-seed-v1") — so the issued signature validates against
// the public key BAKED into verify.ts (the only key the verifier trusts). Also asserts the security
// floor: timing-safe Bearer gate (missing/wrong → 401), Zod `.strict()` body (unknown field → 400),
// /health public + security headers.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  type RegistryIndex,
  loadRegistryIndex,
} from "@caisson/registry-schema";
import { Ed25519Signer } from "@caisson/license-issue";
import { verifyLicense } from "@caisson/license-verify";
import { type TestPg, newTestPg } from "@caisson/testing";
import { withTenant } from "@caisson/tenancy-rls";
import { createApp } from "./app.ts";
import {
  ENTITLEMENT_SCHEMA_SQL,
  grantEntitlements,
} from "./entitlement-store.ts";

const TOKEN = "test-license-issue-token-0123456789";
const KAT_SEED = Uint8Array.from(
  createHash("sha256").update("caisson-license-verify-KAT-seed-v1").digest(),
);
const signer = new Ed25519Signer("kat", KAT_SEED);

/** A synthetic registry index: base (oss/Apache) + a compliance edition member (commercial/paid). */
function entry(id: string, editions: readonly string[]): unknown {
  const open = editions.length === 0;
  return {
    id,
    latest: "1.0.0",
    versions: [
      {
        version: "1.0.0",
        publishedAt: "2026-01-01T00:00:00.000Z",
        gateAttestation: "ci-run-1@deadbeef",
        manifest: {
          id,
          version: "1.0.0",
          kind: "base",
          tier: open ? "oss" : "paid",
          license: open ? "Apache-2.0" : "LicenseRef-Caisson-Commercial",
          priceCents: open ? null : 4900,
          editions: [...editions],
          description: id,
        },
      },
    ],
  };
}

const index: RegistryIndex = loadRegistryIndex({
  schemaVersion: 1,
  modules: [
    entry("@caisson/kernel", []),
    entry("@caisson/compliance", ["compliance"]),
  ],
});

let tp: TestPg;
let app: (req: Request) => Promise<Response>;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(ENTITLEMENT_SCHEMA_SQL);
  app = createApp({ token: TOKEN, signer, index, db: tp.pg });
});
afterAll(async () => {
  await tp.close();
});

const post = (body: string, auth?: string): Request =>
  new Request("http://license.test/issue", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth !== undefined ? { authorization: auth } : {}),
    },
    body,
  });

describe("POST /issue (ADR-0108)", () => {
  test("issues a token for a purchased account that verifies to its resolved entitlements", async () => {
    const acct = "acct_issue_comp";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "in_1",
      }),
    );
    const res = await app(
      post(
        JSON.stringify({
          accountId: acct,
          tier: "pro",
          major: 1,
          expiry: null,
        }),
        `Bearer ${TOKEN}`,
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; licenseId: string };
    expect(body.licenseId).toMatch(/^[0-9a-f-]{36}$/);

    const verified = verifyLicense(body.token);
    expect(verified.valid).toBe(true);
    expect(verified.tier).toBe("pro");
    // The signed entitlements are the account's index-resolved member slugs (server-side truth).
    expect(verified.entitlements).toEqual(["@caisson/compliance"]);
    expect(verified.claims?.licenseId).toBe(body.licenseId);
  });

  test("an account with no purchases issues a token with empty entitlements", async () => {
    const res = await app(
      post(
        JSON.stringify({
          accountId: "acct_empty",
          tier: "community",
          major: 1,
          expiry: null,
        }),
        `Bearer ${TOKEN}`,
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string };
    expect(verifyLicense(body.token).entitlements).toEqual([]);
  });

  test("without a Bearer → 401", async () => {
    const res = await app(
      post(
        JSON.stringify({ accountId: "a", tier: "pro", major: 1, expiry: null }),
      ),
    );
    expect(res.status).toBe(401);
  });

  test("with a wrong Bearer → 401", async () => {
    const res = await app(
      post(
        JSON.stringify({ accountId: "a", tier: "pro", major: 1, expiry: null }),
        "Bearer wrong-token",
      ),
    );
    expect(res.status).toBe(401);
  });

  test("an unknown body field → 400 (Zod .strict())", async () => {
    const res = await app(
      post(
        JSON.stringify({
          accountId: "a",
          tier: "pro",
          major: 1,
          expiry: null,
          evil: 1,
        }),
        `Bearer ${TOKEN}`,
      ),
    );
    expect(res.status).toBe(400);
  });

  test("an unknown tier → 400 (shared licenseTierSchema)", async () => {
    const res = await app(
      post(
        JSON.stringify({
          accountId: "a",
          tier: "enterprise",
          major: 1,
          expiry: null,
        }),
        `Bearer ${TOKEN}`,
      ),
    );
    expect(res.status).toBe(400);
  });

  test("invalid JSON → 400", async () => {
    const res = await app(post("{not json", `Bearer ${TOKEN}`));
    expect(res.status).toBe(400);
  });

  test("wrong method on /issue → 405", async () => {
    const res = await app(
      new Request("http://license.test/issue", {
        method: "GET",
        headers: { authorization: `Bearer ${TOKEN}` },
      }),
    );
    expect(res.status).toBe(405);
  });
});

describe("issuer non-issue routes", () => {
  test("GET /health → 200 + security headers (public)", async () => {
    const res = await app(new Request("http://license.test/health"));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=");
  });

  test("unknown path → 404", async () => {
    const res = await app(new Request("http://license.test/nope"));
    expect(res.status).toBe(404);
  });
});
