// The license-issuer HTTP surface end to end (ADR-0110): POST /issue resolves an account's entitlements
// over PGlite + real `withTenant` RLS, signs them via @caisson/license-issue, and the returned token
// verifies under the SHIPPED @caisson/license-verify verify logic. The SHIPPED verifier bakes the
// PRODUCTION public key, whose private half is not in the repo — so the test signer uses a deterministic
// DEV keypair (SHA-256("caisson-license-verify-KAT-seed-v1"), a TEST vector) and the issued token is
// verified through the explicit-key seam `verifyLicenseWithKey(token, DEV_PUB)`. Also asserts the
// security floor: timing-safe Bearer gate (missing/wrong → 401), Zod `.strict()` body (unknown field →
// 400), /health public + security headers. And the persistence contract ("persist & reuse"): a second
// /issue for the SAME (accountId, major) re-serves the byte-identical STORED token (no re-mint, no
// second row), while a different major mints + stores its own independent grant.
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
import {
  type KeyObject,
  createHash,
  createPrivateKey,
  createPublicKey,
} from "node:crypto";
import {
  type RegistryIndex,
  loadRegistryIndex,
} from "@caisson/registry-schema";
import { Ed25519Signer } from "@caisson/license-issue";
import { verifyLicenseWithKey } from "@caisson/license-verify";
import { type TestPg, newTestPg } from "@caisson/testing";
import { withTenant } from "@caisson/tenancy-rls";
import { createApp } from "./app.ts";
import type { RateLimiterInfraAlert } from "./alerting.ts";
import {
  ENTITLEMENT_GRANT_CHARGED_AMOUNT_MIGRATION_SQL,
  ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL,
  ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL,
  RENEWAL_EXTENSION_MONTHS_MIGRATION_SQL,
  RENEWAL_EXTENSION_SCHEMA_SQL,
  ENTITLEMENT_SCHEMA_SQL,
  extendUpdatesWindow,
  grantEntitlements,
} from "./entitlement-store.ts";
import {
  loadRateLimitConfig,
  type RateLimiter,
  TokenBucketLimiter,
} from "./rate-limit.ts";
import {
  LICENSE_GRANT_SCHEMA_SQL,
  readLicenseGrant,
} from "./license-grant-store.ts";

const TOKEN = "test-license-issue-token-0123456789";
const DEV_SEED = createHash("sha256")
  .update("caisson-license-verify-KAT-seed-v1")
  .digest();
// Ed25519 PKCS#8 DER = 16-byte fixed prefix ‖ 32-byte raw seed (RFC 8410).
const devPrivate: KeyObject = createPrivateKey({
  key: Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    DEV_SEED,
  ]),
  format: "der",
  type: "pkcs8",
});
/** The DEV public key the issued token is verified against (the SHIPPED baked key is prod).
 * Derived via the private key's PEM (`createPublicKey(KeyObject)`'s overload is absent from bun-types). */
const DEV_PUB: KeyObject = createPublicKey(
  devPrivate.export({ format: "pem", type: "pkcs8" }),
);
const signer = new Ed25519Signer("dev", devPrivate);

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
  await tp.exec(ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_CHARGED_AMOUNT_MIGRATION_SQL);
  await tp.exec(RENEWAL_EXTENSION_SCHEMA_SQL);
  await tp.exec(RENEWAL_EXTENSION_MONTHS_MIGRATION_SQL);
  await tp.exec(LICENSE_GRANT_SCHEMA_SQL);
  // provider: null — these tests exercise POST /issue only; /webhook is covered in
  // webhook-app.integration.test.ts. A null provider makes /webhook fail closed (401), not these routes.
  // A permissive limiter (default budgets) lets the suite's handful of /issue calls through.
  app = createApp({
    token: TOKEN,
    signer,
    index,
    db: tp.pg,
    provider: null,
    limiter: new TokenBucketLimiter(loadRateLimitConfig()),
    discordNotify: null,
    posthogCapture: null,
    purchaseEmailNotify: async () => {},
    renewalEmailNotify: async () => {},
    revokeEmailNotify: async () => {},
    chargebackAlert: async () => {},
    rateLimiterAlert: async () => {},
  });
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

describe("POST /issue (ADR-0110)", () => {
  for (const pathname of ["/issue", "/admin/affiliate/mint"] as const) {
    for (const stage of ["check", "checkGlobal"] as const) {
      test(`${pathname} fails closed with 503 and alerts when limiter ${stage} throws`, async () => {
        const alerts: RateLimiterInfraAlert[] = [];
        const limiter: RateLimiter = {
          check: () => {
            if (stage === "check") throw new Error("limiter unavailable");
            return { allowed: true, retryAfterSec: 0 };
          },
          checkGlobal: () => {
            if (stage === "checkGlobal") throw new Error("limiter unavailable");
            return { allowed: true, retryAfterSec: 0 };
          },
        };
        const limitedApp = createApp({
          token: TOKEN,
          signer,
          index,
          db: tp.pg,
          provider: null,
          limiter,
          discordNotify: null,
          posthogCapture: null,
          purchaseEmailNotify: async () => {},
          renewalEmailNotify: async () => {},
          revokeEmailNotify: async () => {},
          chargebackAlert: async () => {},
          rateLimiterAlert: async (alert) => {
            alerts.push(alert);
          },
        });

        const response = await limitedApp(
          new Request(`http://license.test${pathname}`, { method: "POST" }),
        );

        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({
          error: "rate limiter unavailable",
        });
        expect(alerts).toEqual([{ bucket: "issue", failureMode: "closed" }]);
      });
    }
  }

  test("issues a token for a purchased account that verifies to its resolved entitlements", async () => {
    const acct = "acct_issue_comp";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "in_1",
        source: { kind: "subscription", subscriptionId: "sub_1" },
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

    const verified = verifyLicenseWithKey(body.token, DEV_PUB);
    expect(verified.valid).toBe(true);
    expect(verified.tier).toBe("pro");
    // The signed entitlements are the account's PURCHASED ids (the claims contract — consumers
    // expand at verification; audit F2 2026-07-06), never the index expansion.
    expect(verified.entitlements).toEqual(["compliance"]);
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
    expect(verifyLicenseWithKey(body.token, DEV_PUB).entitlements).toEqual([]);
  });

  test("persist & reuse: a second /issue for the SAME (account, major) re-serves the stored token", async () => {
    const acct = "acct_issue_persist";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "in_persist",
        source: { kind: "subscription", subscriptionId: "sub_persist" },
      }),
    );
    const body = JSON.stringify({
      accountId: acct,
      tier: "pro",
      major: 1,
      expiry: null,
    });

    const first = await app(post(body, `Bearer ${TOKEN}`));
    expect(first.status).toBe(200);
    const firstJson = (await first.json()) as {
      token: string;
      licenseId: string;
    };

    const second = await app(post(body, `Bearer ${TOKEN}`));
    expect(second.status).toBe(200);
    const secondJson = (await second.json()) as {
      token: string;
      licenseId: string;
    };

    // Byte-identical re-serve, not a re-mint — a re-mint would stamp a FRESH randomUUID licenseId.
    expect(secondJson.token).toBe(firstJson.token);
    expect(secondJson.licenseId).toBe(firstJson.licenseId);

    // Exactly one row landed for (account, major) — no proliferation of perpetual tokens.
    const rows = await tp.query(
      `SELECT count(*)::int AS n FROM license_grant WHERE account_id = $1 AND major = $2`,
      [acct, 1],
    );
    expect((rows[0] as { n: number }).n).toBe(1);

    // Round-trip: the persisted grant IS the served token, and it independently verifies.
    const stored = await withTenant(tp.pg, acct, (tx) =>
      readLicenseGrant(tx, acct, 1),
    );
    expect(stored?.token).toBe(firstJson.token);
    expect(verifyLicenseWithKey(stored?.token ?? "", DEV_PUB).valid).toBe(true);
  });

  test("rotate: true forces a FRESH mint that replaces the stored grant in place (key rotation)", async () => {
    const acct = "acct_issue_rotate";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "in_rotate",
        source: { kind: "subscription", subscriptionId: "sub_rotate" },
      }),
    );
    const body = { accountId: acct, tier: "pro", major: 1, expiry: null };

    const first = await app(post(JSON.stringify(body), `Bearer ${TOKEN}`));
    expect(first.status).toBe(200);
    const a = (await first.json()) as { token: string; licenseId: string };

    // The rotation mint: claims are UNCHANGED, so a plain call would re-serve — rotate must not.
    const rotated = await app(
      post(JSON.stringify({ ...body, rotate: true }), `Bearer ${TOKEN}`),
    );
    expect(rotated.status).toBe(200);
    const b = (await rotated.json()) as { token: string; licenseId: string };
    expect(b.licenseId).not.toBe(a.licenseId);
    expect(b.token).not.toBe(a.token);
    expect(verifyLicenseWithKey(b.token, DEV_PUB).valid).toBe(true);

    // Replaced IN PLACE: still exactly one row per (account, major), now holding the fresh key.
    const rows = await tp.query(
      `SELECT count(*)::int AS n FROM license_grant WHERE account_id = $1 AND major = $2`,
      [acct, 1],
    );
    expect((rows[0] as { n: number }).n).toBe(1);
    const stored = await withTenant(tp.pg, acct, (tx) =>
      readLicenseGrant(tx, acct, 1),
    );
    expect(stored?.licenseId).toBe(b.licenseId);

    // The persist-and-reuse contract resumes on the NEW key: a plain call re-serves it.
    const third = await app(post(JSON.stringify(body), `Bearer ${TOKEN}`));
    const c = (await third.json()) as { token: string; licenseId: string };
    expect(c.token).toBe(b.token);
    expect(c.licenseId).toBe(b.licenseId);
  });

  test("a different major for the same account mints + stores its own independent grant", async () => {
    const acct = "acct_issue_major";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "in_major",
        source: { kind: "subscription", subscriptionId: "sub_major" },
      }),
    );
    const v1Res = await app(
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
    const v2Res = await app(
      post(
        JSON.stringify({
          accountId: acct,
          tier: "pro",
          major: 2,
          expiry: null,
        }),
        `Bearer ${TOKEN}`,
      ),
    );
    const v1Json = (await v1Res.json()) as {
      token: string;
      licenseId: string;
    };
    const v2Json = (await v2Res.json()) as {
      token: string;
      licenseId: string;
    };
    expect(v1Json.licenseId).not.toBe(v2Json.licenseId);
    expect(v1Json.token).not.toBe(v2Json.token);

    const rows = await tp.query(
      `SELECT count(*)::int AS n FROM license_grant WHERE account_id = $1`,
      [acct],
    );
    expect((rows[0] as { n: number }).n).toBe(2);
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

// ADR-0220 Fork AM-5: the distinct admin-scoped issue credential. A second app instance is wired
// with an `adminToken` alongside the primary `token`; the reissue proxy authenticates with THAT
// credential (never LICENSE_ISSUE_TOKEN). Asserts: the admin token authorizes /issue, it re-serves
// the SAME persisted token (idempotent reissue), it does not weaken the primary-token gate, and a
// request with no bearer still 401s. The compare is the same SHA-256 → timingSafeEqual path as the
// primary token (app.ts `tokenMatches`).
describe("POST /issue admin-scoped credential (ADR-0220)", () => {
  const ADMIN_TOKEN = "admin-scoped-issue-token-distinct-9876";
  let adminApp: (req: Request) => Promise<Response>;

  beforeAll(() => {
    adminApp = createApp({
      token: TOKEN,
      adminToken: ADMIN_TOKEN,
      signer,
      index,
      db: tp.pg,
      provider: null,
      limiter: new TokenBucketLimiter(loadRateLimitConfig()),
      discordNotify: null,
      posthogCapture: null,
      purchaseEmailNotify: async () => {},
      renewalEmailNotify: async () => {},
      revokeEmailNotify: async () => {},
      chargebackAlert: async () => {},
      rateLimiterAlert: async () => {},
    });
  });

  test("the admin token authorizes /issue and reissue re-serves the SAME stored token", async () => {
    const acct = "acct_admin_reissue";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "in_admin",
        source: { kind: "subscription", subscriptionId: "sub_admin" },
      }),
    );
    const body = JSON.stringify({
      accountId: acct,
      tier: "pro",
      major: 1,
      expiry: null,
    });
    // First issue under the admin token mints + persists.
    const first = await adminApp(post(body, `Bearer ${ADMIN_TOKEN}`));
    expect(first.status).toBe(200);
    const firstJson = (await first.json()) as {
      token: string;
      licenseId: string;
    };
    // Reissue under the admin token re-serves byte-identically (idempotent), never a re-mint.
    const second = await adminApp(post(body, `Bearer ${ADMIN_TOKEN}`));
    expect(second.status).toBe(200);
    const secondJson = (await second.json()) as {
      token: string;
      licenseId: string;
    };
    expect(secondJson.token).toBe(firstJson.token);
    expect(secondJson.licenseId).toBe(firstJson.licenseId);
  });

  test("the primary token still works on the admin-configured app", async () => {
    const res = await adminApp(
      post(
        JSON.stringify({
          accountId: "acct_admin_primary",
          tier: "pro",
          major: 1,
          expiry: null,
        }),
        `Bearer ${TOKEN}`,
      ),
    );
    expect(res.status).toBe(200);
  });

  test("no bearer → 401, and a wrong bearer → 401 (credential gating)", async () => {
    const noBearer = await adminApp(
      post(
        JSON.stringify({ accountId: "a", tier: "pro", major: 1, expiry: null }),
      ),
    );
    expect(noBearer.status).toBe(401);
    const wrong = await adminApp(
      post(
        JSON.stringify({ accountId: "a", tier: "pro", major: 1, expiry: null }),
        "Bearer neither-token",
      ),
    );
    expect(wrong.status).toBe(401);
  });

  test("an app WITHOUT an admin token rejects the admin credential (no accidental widening)", async () => {
    // `app` (the default suite instance) has no adminToken → the admin credential is just a wrong bearer.
    const res = await app(
      post(
        JSON.stringify({ accountId: "a", tier: "pro", major: 1, expiry: null }),
        `Bearer ${ADMIN_TOKEN}`,
      ),
    );
    expect(res.status).toBe(401);
  });
});

// ADR-0244/0255: the signed per-entitlement updates windows. /issue computes `updatesWindows` from
// DB truth (per (account, entitlement) pair: earliest active one_time granted_at + 12 months,
// overridden by a renewal's updates_expires_at) and signs it into the claims; the (accountId, major)
// persist-and-reuse idempotency is LOOSENED to re-mint when the computed map CANONICALLY differs from
// the stored token's claim (Decision 3/4) — while an UNCHANGED map keeps the byte-identical re-serve
// (the persist&reuse suite above stays green: subscription-only accounts compute the empty map =
// unbounded).
describe("POST /issue updates windows (ADR-0244/0255)", () => {
  const issueBody = (acct: string) =>
    JSON.stringify({ accountId: acct, tier: "pro", major: 1, expiry: null });

  test("a one-time buyer's token carries updatesWindows[entitlementId] = granted_at + 12 months", async () => {
    const acct = "acct_win_onetime";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_win_1",
        source: { kind: "one_time", purchaseId: "pay_win_1" },
      }),
    );
    // Pin granted_at for deterministic window math (superuser bypasses RLS).
    await tp.query(
      `UPDATE entitlement_grant SET granted_at = '2026-01-05T00:00:00.000Z' WHERE account_id = $1`,
      [acct],
    );
    const res = await app(post(issueBody(acct), `Bearer ${TOKEN}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string };
    const verified = verifyLicenseWithKey(body.token, DEV_PUB);
    expect(verified.valid).toBe(true);
    expect(verified.claims?.updatesWindows).toEqual({
      compliance: "2027-01-05T00:00:00.000Z",
    });
  });

  test("a subscription-only account's token carries an empty updatesWindows map (unbounded, ADR-0244 §4)", async () => {
    const acct = "acct_win_subonly_issue";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "in_win_sub",
        source: { kind: "subscription", subscriptionId: "sub_win" },
      }),
    );
    const res = await app(post(issueBody(acct), `Bearer ${TOKEN}`));
    const body = (await res.json()) as { token: string };
    const verified = verifyLicenseWithKey(body.token, DEV_PUB);
    expect(verified.valid).toBe(true);
    expect(verified.claims?.updatesWindows).toEqual({});
  });

  test("UNCHANGED map → stored token re-served byte-identical; CHANGED map → re-mint in place", async () => {
    const acct = "acct_win_remint";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_win_2",
        source: { kind: "one_time", purchaseId: "pay_win_2" },
      }),
    );
    const first = (await (
      await app(post(issueBody(acct), `Bearer ${TOKEN}`))
    ).json()) as { token: string; licenseId: string };

    // Window unchanged — persist & reuse still holds.
    const again = (await (
      await app(post(issueBody(acct), `Bearer ${TOKEN}`))
    ).json()) as { token: string; licenseId: string };
    expect(again.token).toBe(first.token);
    expect(again.licenseId).toBe(first.licenseId);

    // A renewal lands (extends the window) → the next /issue RE-MINTS (Decision 3).
    await withTenant(tp.pg, acct, (tx) =>
      extendUpdatesWindow(tx, {
        accountId: acct,
        entitlementId: "compliance",
        sourceEventId: "pay_win_renewal",
      }),
    );
    const reminted = (await (
      await app(post(issueBody(acct), `Bearer ${TOKEN}`))
    ).json()) as { token: string; licenseId: string };
    expect(reminted.token).not.toBe(first.token);
    expect(reminted.licenseId).not.toBe(first.licenseId);
    const firstWindow =
      verifyLicenseWithKey(first.token, DEV_PUB).claims?.updatesWindows
        ?.compliance ?? "";
    const remintedWindow =
      verifyLicenseWithKey(reminted.token, DEV_PUB).claims?.updatesWindows
        ?.compliance ?? "";
    expect(Date.parse(remintedWindow)).toBeGreaterThan(Date.parse(firstWindow));

    // Still exactly ONE row per (account, major): the re-mint replaced the stored token in place.
    const rows = await tp.query(
      `SELECT count(*)::int AS n FROM license_grant WHERE account_id = $1 AND major = 1`,
      [acct],
    );
    expect((rows[0] as { n: number }).n).toBe(1);
    const stored = await withTenant(tp.pg, acct, (tx) =>
      readLicenseGrant(tx, acct, 1),
    );
    expect(stored?.token).toBe(reminted.token);

    // And the NEW map is now the stable one — a further /issue re-serves it byte-identical.
    const afterRemint = (await (
      await app(post(issueBody(acct), `Bearer ${TOKEN}`))
    ).json()) as { token: string };
    expect(afterRemint.token).toBe(reminted.token);
  });

  test("renewing entitlement X re-mints and extends ONLY X's window — an unrenewed entitled Y keeps its own", async () => {
    const acct = "acct_win_pair_issue";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance", "local-first"],
        sourceEventId: "pay_win_pair",
        source: { kind: "one_time", purchaseId: "pay_win_pair" },
      }),
    );
    const before = (await (
      await app(post(issueBody(acct), `Bearer ${TOKEN}`))
    ).json()) as { token: string };
    const beforeWindows =
      verifyLicenseWithKey(before.token, DEV_PUB).claims?.updatesWindows ?? {};
    expect(beforeWindows.compliance).toBeDefined();
    expect(beforeWindows["local-first"]).toBeDefined();

    // Renewing ONLY compliance extends ONLY its window.
    await withTenant(tp.pg, acct, (tx) =>
      extendUpdatesWindow(tx, {
        accountId: acct,
        entitlementId: "compliance",
        sourceEventId: "pay_win_pair_renew",
      }),
    );
    const after = (await (
      await app(post(issueBody(acct), `Bearer ${TOKEN}`))
    ).json()) as { token: string };
    const afterWindows =
      verifyLicenseWithKey(after.token, DEV_PUB).claims?.updatesWindows ?? {};
    expect(Date.parse(afterWindows.compliance as string)).toBeGreaterThan(
      Date.parse(beforeWindows.compliance as string),
    );
    // local-first's window is BYTE-IDENTICAL — no cross-entitlement coupling (ADR-0255 D2).
    expect(afterWindows["local-first"]).toBe(beforeWindows["local-first"]);
  });
});

describe("POST /issue snapshot-at-sale entitledSince (ADR-0257 §1.2)", () => {
  const issueBody = (acct: string) =>
    JSON.stringify({ accountId: acct, tier: "pro", major: 1, expiry: null });

  test("a one-time buyer's token carries entitledSince[entitlementId] = granted_at", async () => {
    const acct = "acct_since_issue";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_since_1",
        source: { kind: "one_time", purchaseId: "pay_since_1" },
      }),
    );
    await tp.query(
      `UPDATE entitlement_grant SET granted_at = '2026-07-06T00:00:00.000Z' WHERE account_id = $1`,
      [acct],
    );
    const res = await app(post(issueBody(acct), `Bearer ${TOKEN}`));
    const body = (await res.json()) as { token: string };
    const verified = verifyLicenseWithKey(body.token, DEV_PUB);
    expect(verified.claims?.entitledSince).toEqual({
      compliance: "2026-07-06T00:00:00.000Z",
    });
  });

  test("a subscription-only account's token carries an empty entitledSince map (grandfathered)", async () => {
    const acct = "acct_since_subonly";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "in_since_sub",
        source: { kind: "subscription", subscriptionId: "sub_since" },
      }),
    );
    const body = (await (
      await app(post(issueBody(acct), `Bearer ${TOKEN}`))
    ).json()) as { token: string };
    expect(
      verifyLicenseWithKey(body.token, DEV_PUB).claims?.entitledSince,
    ).toEqual({});
  });

  test("entitledSince change ALONE re-mints even when updatesWindows is byte-identical", async () => {
    // Isolate the entitledSince axis: keep the window constant across two purchases (same
    // updates_expires_at) while a later granted_at moves the snapshot — proving entitledSince is in
    // the re-mint comparison, not just updatesWindows.
    const acct = "acct_since_remint";
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_es_a",
        source: { kind: "one_time", purchaseId: "pay_es_a" },
      }),
    );
    await tp.query(
      `UPDATE entitlement_grant
          SET granted_at = '2026-01-05T00:00:00.000Z',
              updates_expires_at = '2028-01-05T00:00:00.000Z'
        WHERE account_id = $1 AND source_event_id = 'pay_es_a'`,
      [acct],
    );
    const first = (await (
      await app(post(issueBody(acct), `Bearer ${TOKEN}`))
    ).json()) as { token: string; licenseId: string };
    const firstClaims = verifyLicenseWithKey(first.token, DEV_PUB).claims;
    expect(firstClaims?.entitledSince).toEqual({
      compliance: "2026-01-05T00:00:00.000Z",
    });

    // A second purchase of the SAME entitlement, later granted_at, SAME window bound.
    await withTenant(tp.pg, acct, (tx) =>
      grantEntitlements(tx, {
        accountId: acct,
        entitlementIds: ["compliance"],
        sourceEventId: "pay_es_b",
        source: { kind: "one_time", purchaseId: "pay_es_b" },
      }),
    );
    await tp.query(
      `UPDATE entitlement_grant
          SET granted_at = '2026-06-01T00:00:00.000Z',
              updates_expires_at = '2028-01-05T00:00:00.000Z'
        WHERE account_id = $1 AND source_event_id = 'pay_es_b'`,
      [acct],
    );
    const reminted = (await (
      await app(post(issueBody(acct), `Bearer ${TOKEN}`))
    ).json()) as { token: string; licenseId: string };
    const remintedClaims = verifyLicenseWithKey(reminted.token, DEV_PUB).claims;

    // Re-minted (fresh token + licenseId) …
    expect(reminted.token).not.toBe(first.token);
    expect(reminted.licenseId).not.toBe(first.licenseId);
    // … driven by entitledSince (moved to the later purchase) …
    expect(remintedClaims?.entitledSince).toEqual({
      compliance: "2026-06-01T00:00:00.000Z",
    });
    // … while updatesWindows stayed byte-identical (the isolation).
    expect(remintedClaims?.updatesWindows).toEqual(firstClaims?.updatesWindows);
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
