// The Paddle webhook HTTP route end to end (ADR-0108/0116, services-hardening #3): drive POST /webhook
// on the REAL createApp router with the REAL createPaddleBilling provider (real HMAC verify + parse +
// the real grant mapper over PGlite/withTenant), proving the route binds a verified purchase to BOTH
// the credit grant and the entitlement grant in one tenant transaction. The handleBillingWebhook /
// applyBillingEvent grant LOGIC is covered in webhook.integration.test.ts + paddle-webhook.integration.
// test.ts; this file covers the ROUTE seam the audit flagged (status codes, raw-body verification,
// AuthnError→401 fail-closed, replay idempotency through the HTTP surface).
import { createHash, createHmac, createPrivateKey } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { BillingProvider } from "@caisson/billing";
import { createPaddleBilling } from "@caisson/billing";
import { CREDIT_SCHEMA_SQL, balance } from "@caisson/credits";
import { Ed25519Signer } from "@caisson/license-issue";
import {
  type RegistryIndex,
  loadRegistryIndex,
} from "@caisson/registry-schema";
import { type TestPg, newTestPg } from "@caisson/testing";
import { withTenant } from "@caisson/tenancy-rls";
import { createApp, type IssueAppDeps } from "./app.ts";
import {
  ENTITLEMENT_SCHEMA_SQL,
  readEntitlements,
} from "./entitlement-store.ts";
import {
  loadRateLimitConfig,
  type RateLimitConfig,
  TokenBucketLimiter,
} from "./rate-limit.ts";

const SECRET = "pdl_ntfset_webhook_route_secret";

// REAL Paddle sandbox price ids (paddle-pricebook-roundtrip.test.ts). The edition buys grant entitlements
// (credits: 0); the only one-time row carrying credits is the credit-pack PLACEHOLDER, so the credit-grant
// path is exercised through that — no single price-book row carries BOTH credits and an entitlement.
const PRICE_COMPLIANCE_ONETIME = "pri_01kwd76be2eq96kff5nqw236c0"; // -> entitlement "compliance"
const PRICE_DEVELOPER_SUB = "pri_01kwd76d64rz2ecm090pt4nq5q"; // -> 1000 credits/cycle, no entitlement
const PRICE_CREDIT_PACK = "price_credit_pack_PLACEHOLDER"; // -> 5000 credits, no entitlement

function signed(body: string, t: number): string {
  const sig = createHmac("sha256", SECRET).update(`${t}:${body}`).digest("hex");
  return `ts=${t};h1=${sig}`;
}

// A dev signer + empty index satisfy createApp's deps; POST /webhook touches NEITHER (only /issue does).
const devPrivate = createPrivateKey({
  key: Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    createHash("sha256").update("caisson-webhook-route-test-seed").digest(),
  ]),
  format: "der",
  type: "pkcs8",
});
const signer = new Ed25519Signer("dev", devPrivate);
const index: RegistryIndex = loadRegistryIndex({
  schemaVersion: 1,
  modules: [],
});

let tp: TestPg;
let provider: BillingProvider;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(CREDIT_SCHEMA_SQL);
  await tp.exec(ENTITLEMENT_SCHEMA_SQL);
  provider = createPaddleBilling({ webhookSecret: SECRET, apiKey: "pdl_test" });
});
afterAll(async () => {
  await tp.close();
});

function makeApp(
  p: BillingProvider | null,
  limiterConfig: RateLimitConfig = loadRateLimitConfig(),
  discordNotify: IssueAppDeps["discordNotify"] = null,
): (req: Request) => Promise<Response> {
  return createApp({
    token: "unused-issue-token",
    signer,
    index,
    db: tp.pg,
    provider: p,
    limiter: new TokenBucketLimiter(limiterConfig),
    discordNotify,
  });
}

function webhookReq(
  rawBody: string,
  signature: string | null,
  ip = "1.2.3.4",
): Request {
  return new Request("http://license.test/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      ...(signature !== null ? { "paddle-signature": signature } : {}),
    },
    body: rawBody,
  });
}

function oneTimeBody(eventId: string, txnId: string, priceId: string): string {
  return JSON.stringify({
    event_id: eventId,
    event_type: "transaction.completed",
    data: {
      id: txnId,
      subscription_id: null,
      currency_code: "usd",
      custom_data: { account_id: `acct_${txnId}` },
      items: [{ price: { id: priceId } }],
      details: { totals: { grand_total: "129900" } },
    },
  });
}

describe("POST /webhook (Paddle MoR, ADR-0108/0116)", () => {
  test("a valid one-time edition purchase returns 200 and grants the entitlement", async () => {
    const app = makeApp(provider);
    const acct = "acct_txn_edition_1";
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event_id: "evt_edition_1",
      event_type: "transaction.completed",
      data: {
        id: "txn_edition_1",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: PRICE_COMPLIANCE_ONETIME } }],
        details: { totals: { grand_total: "249900" } },
      },
    });
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBe(200);

    const entitlements = await withTenant(tp.pg, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(entitlements).toEqual(["compliance"]); // entitlement-grant path fired
    const bal = await withTenant(tp.pg, acct, (tx) => balance(tx, acct));
    expect(bal).toBe(0); // credit-grant branch ran as a clean no-op (this row carries no credits)
  });

  test("a valid one-time credit-pack purchase grants credits, and a replay of the same event_id is a no-op", async () => {
    const app = makeApp(provider);
    const acct = "acct_txn_credits_1";
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event_id: "evt_credits_1",
      event_type: "transaction.completed",
      data: {
        id: "txn_credits_1",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: PRICE_CREDIT_PACK } }],
        details: { totals: { grand_total: "5000" } },
      },
    });
    const sig = signed(body, t);

    const first = await app(webhookReq(body, sig));
    expect(first.status).toBe(200);
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(5000);

    // Replay the byte-identical signed delivery — same event_id → same txn/payment id → the credit
    // ledger's source-id idempotency absorbs it (ADR-0113). Balance must NOT double.
    const replay = await app(webhookReq(body, sig));
    expect(replay.status).toBe(200);
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(5000);
  });

  test("a subscription-linked transaction grants the cycle credits (invoice.paid path)", async () => {
    const app = makeApp(provider);
    const acct = "acct_txn_sub_1";
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event_id: "evt_sub_1",
      event_type: "transaction.completed",
      data: {
        id: "txn_sub_1",
        subscription_id: "sub_route_1",
        // First-charge origin ("web"); subscription_charge is mid-cycle and non-granting (2026-07-01).
        origin: "web",
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: PRICE_DEVELOPER_SUB } }],
        details: { totals: { grand_total: "49900" } },
      },
    });
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBe(200);
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(1000);
  });

  test("a verified purchase with no resolvable account_id returns non-2xx, so Paddle retries (services-hardening LOW)", async () => {
    // A genuine, correctly-signed purchase whose custom_data never carried account_id (or carried an
    // empty one) — provisioning nothing must NOT be a silent 2xx: that would drop a real purchase for
    // good once Paddle stops retrying. The route must surface this as a server error.
    const app = makeApp(provider);
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event_id: "evt_unattributed",
      event_type: "transaction.completed",
      data: {
        id: "txn_unattributed",
        subscription_id: null,
        currency_code: "usd",
        custom_data: {},
        items: [{ price: { id: PRICE_CREDIT_PACK } }],
        details: { totals: { grand_total: "5000" } },
      },
    });
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.status).toBeLessThan(600);
  });

  test("a bad signature returns 401 and provisions NOTHING (fail-closed, never throws to the socket)", async () => {
    const app = makeApp(provider);
    const acct = "acct_badsig";
    const body = oneTimeBody("evt_badsig", "acct_badsig", PRICE_CREDIT_PACK);
    const res = await app(webhookReq(body, "ts=1;h1=deadbeef"));
    expect(res.status).toBe(401);
    // No grant landed under the (forged) tenant.
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(0);
  });

  test("a missing signature header returns 401", async () => {
    const app = makeApp(provider);
    const body = oneTimeBody("evt_nosig", "txn_nosig", PRICE_CREDIT_PACK);
    const res = await app(webhookReq(body, null));
    expect(res.status).toBe(401);
  });

  test("a null provider (PADDLE_WEBHOOK_SECRET unset) fails closed with 401", async () => {
    const app = makeApp(null);
    const t = Math.floor(Date.now() / 1000);
    const body = oneTimeBody("evt_noprov", "txn_noprov", PRICE_CREDIT_PACK);
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBe(401);
  });

  test("a non-POST method on /webhook → 405", async () => {
    const app = makeApp(provider);
    const res = await app(new Request("http://license.test/webhook"));
    expect(res.status).toBe(405);
  });

  test("a per-IP flood on /webhook is capped with 429 (Retry-After) once the bucket is exhausted", async () => {
    // Capacity 1 per window: the first signed delivery passes, the second from the SAME ip is throttled.
    const app = makeApp(provider, {
      webhook: { capacity: 1, windowMs: 60_000 },
      issue: { capacity: 1, windowMs: 60_000 },
      maxEntries: 100,
    });
    const acct = "acct_rl_webhook";
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event_id: "evt_rl_1",
      event_type: "transaction.completed",
      data: {
        id: "txn_rl_1",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: PRICE_CREDIT_PACK } }],
        details: { totals: { grand_total: "5000" } },
      },
    });
    const sig = signed(body, t);

    const first = await app(webhookReq(body, sig, "9.9.9.9"));
    expect(first.status).toBe(200);
    const second = await app(webhookReq(body, sig, "9.9.9.9"));
    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).not.toBeNull();
  });

  test("a granting purchase fires the DETACHED discord push with the granted entitlements (ADR-0201)", async () => {
    const pushes: Array<{ accountId: string; entitlements: string[] }> = [];
    const app = makeApp(provider, loadRateLimitConfig(), async (push) => {
      pushes.push(push); // records synchronously before its first await — visible right after app()
    });
    const acct = "acct_txn_push_1";
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event_id: "evt_push_1",
      event_type: "transaction.completed",
      data: {
        id: "txn_push_1",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: PRICE_COMPLIANCE_ONETIME } }],
        details: { totals: { grand_total: "74900" } },
      },
    });
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBe(200);
    expect(pushes).toEqual([{ accountId: acct, entitlements: ["compliance"] }]);
  });

  test("a THROWING discord notifier never fails the webhook 2xx (money path independent of Discord)", async () => {
    const app = makeApp(provider, loadRateLimitConfig(), () => {
      throw new Error("bot exploded synchronously");
    });
    const acct = "acct_txn_push_2";
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event_id: "evt_push_2",
      event_type: "transaction.completed",
      data: {
        id: "txn_push_2",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: PRICE_COMPLIANCE_ONETIME } }],
        details: { totals: { grand_total: "74900" } },
      },
    });
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBe(200); // the grant committed; Discord failure is log-and-drop
    const entitlements = await withTenant(tp.pg, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(entitlements).toEqual(["compliance"]);
  });

  test("a non-granting event (subscription.canceled) fires NO discord push", async () => {
    const pushes: Array<{ accountId: string; entitlements: string[] }> = [];
    const app = makeApp(provider, loadRateLimitConfig(), async (push) => {
      pushes.push(push);
    });
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event_id: "evt_push_cancel",
      event_type: "subscription.canceled",
      data: {
        id: "sub_push_cancel",
        custom_data: { account_id: "acct_txn_push_1" },
      },
    });
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBe(200);
    expect(pushes).toEqual([]);
  });

  test("a per-IP flood on /issue is capped with 429 (limiter runs before the bearer check)", async () => {
    const app = makeApp(provider, {
      webhook: { capacity: 1, windowMs: 60_000 },
      issue: { capacity: 1, windowMs: 60_000 },
      maxEntries: 100,
    });
    const issueReq = (): Request =>
      new Request("http://license.test/issue", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "8.8.8.8",
        },
        body: JSON.stringify({
          accountId: "a",
          tier: "pro",
          major: 1,
          expiry: null,
        }),
      });
    // First call passes the limiter (then 401 — no bearer); the second from the same ip is throttled
    // BEFORE the bearer check, proving the limiter is defense-in-depth ahead of auth.
    const first = await app(issueReq());
    expect(first.status).toBe(401);
    const second = await app(issueReq());
    expect(second.status).toBe(429);
  });

  test("a spoofed leftmost x-forwarded-for hop does not mint a fresh /issue bucket", async () => {
    // Same flood as above, but each request rotates a fake LEFTMOST hop (attacker-controlled) while
    // the edge-appended rightmost hop stays fixed — the exact spoof the HIGH finding described. With
    // clientIp reading the rightmost hop, all three requests must still collapse onto one bucket.
    const app = makeApp(provider, {
      webhook: { capacity: 1, windowMs: 60_000 },
      issue: { capacity: 1, windowMs: 60_000 },
      maxEntries: 100,
    });
    const realIp = "8.8.8.8";
    const issueReq = (fakeLeftHop: string): Request =>
      new Request("http://license.test/issue", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": `${fakeLeftHop}, ${realIp}`,
        },
        body: JSON.stringify({
          accountId: "a",
          tier: "pro",
          major: 1,
          expiry: null,
        }),
      });
    const first = await app(issueReq("1.1.1.1"));
    expect(first.status).toBe(401); // passed the limiter, failed the bearer check
    const second = await app(issueReq("2.2.2.2"));
    expect(second.status).toBe(429); // same rightmost hop → same bucket → throttled
  });
});
