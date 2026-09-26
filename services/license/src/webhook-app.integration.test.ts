// The Paddle webhook HTTP route end to end (ADR-0108/0116, services-hardening #3): drive POST /webhook
// on the REAL createApp router with the REAL createPaddleBilling provider (real HMAC verify + parse +
// the real grant mapper over PGlite/withTenant), proving the route binds a verified purchase to BOTH
// the credit grant and the entitlement grant in one tenant transaction. The handleBillingWebhook /
// applyBillingEvent grant LOGIC is covered in webhook.integration.test.ts + paddle-webhook.integration.
// test.ts; this file covers the ROUTE seam the audit flagged (status codes, raw-body verification,
// AuthnError→401 fail-closed, replay idempotency through the HTTP surface).
import { createHash, createHmac, createPrivateKey } from "node:crypto";
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
import type { BillingProvider } from "@caisson/billing";
import {
  createPaddleBilling,
  PROCESSED_EVENT_SCHEMA_SQL,
} from "@caisson/billing-orchestration";
import {
  CREDIT_LINE_ITEM_MIGRATION_SQL,
  CREDIT_EXPIRY_MIGRATION_SQL,
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
  GRANT_CONSUMPTION_MIGRATION_SQL,
  balance,
} from "@caisson/credits";
import { Ed25519Signer, type Signer } from "@caisson/license-issue";
import { loadOriginGateConfig } from "@caisson/kernel/node";
import {
  type RegistryIndex,
  loadRegistryIndex,
} from "@caisson/registry-schema";
import { type TestPg, newTestPg } from "@caisson/testing";
import { withTenant } from "@caisson/tenancy-rls";
import { createApp as createIssueApp, type IssueAppDeps } from "./app.ts";
import type { RateLimiterInfraAlert } from "./alerting.ts";
import type { ChargebackAlert } from "./chargeback-notify.ts";
import type {
  PurchaseEmailNotice,
  RenewalEmailNotice,
  RevokeEmailNotice,
} from "./email-notify.ts";

import {
  ENTITLEMENT_GRANT_CHARGED_AMOUNT_MIGRATION_SQL,
  ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL,
  ENTITLEMENT_GRANT_REFUNDED_AMOUNT_MIGRATION_SQL,
  ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL,
  RENEWAL_EXTENSION_MONTHS_MIGRATION_SQL,
  RENEWAL_EXTENSION_SCHEMA_SQL,
  ENTITLEMENT_SCHEMA_SQL,
  readEntitlements,
} from "./entitlement-store.ts";
import {
  LICENSE_GRANT_SCHEMA_SQL,
  readLicenseGrant,
} from "./license-grant-store.ts";
import type { PurchaseCapture } from "./posthog-capture.ts";
import {
  loadRateLimitConfig,
  type RateLimiter,
  type RateLimitConfig,
  TokenBucketLimiter,
} from "./rate-limit.ts";
import {
  ORDER_RECORD_SCHEMA_SQL,
  ORDER_RECORD_SUBSCRIPTION_LINK_MIGRATION_SQL,
  ORDER_RECORD_DISCOUNT_MIGRATION_SQL,
  SUBSCRIPTION_STATUS_SCHEMA_SQL,
} from "./subscription-history-store.ts";

const TEST_ORIGIN_GATE = loadOriginGateConfig({
  NODE_ENV: "test",
  ORIGIN_SECRET_MODE: "disabled",
});
const createApp = (
  deps: Parameters<typeof createIssueApp>[0],
): ReturnType<typeof createIssueApp> =>
  createIssueApp({ ...deps, originGate: TEST_ORIGIN_GATE });

const SECRET = "pdl_ntfset_webhook_route_secret";

// REAL Paddle sandbox price ids (paddle-pricebook-roundtrip.test.ts). The edition buys grant entitlements
// (credits: 0); the only one-time row carrying credits is the credit-pack PLACEHOLDER, so the credit-grant
// path is exercised through that — no single price-book row carries BOTH credits and an entitlement.
const PRICE_COMPLIANCE_ONETIME = "pri_01kwd76be2eq96kff5nqw236c0"; // -> entitlement "compliance"
const PRICE_COMPLIANCE_UPDATES_SUB = "pri_01kwd76cwytyyy4yhd9ch0m935"; // sub plan -> grants "compliance"
const PRICE_DEVELOPER_SUB = "pri_01kwd76d64rz2ecm090pt4nq5q"; // -> 1000 credits/cycle, no entitlement
const PRICE_CREDIT_PACK = "price_credit_pack_PLACEHOLDER"; // -> 5000 credits, no entitlement
const PRICE_COMPLIANCE_RENEWAL = "pri_01kwvz6kzh4h43aec3r5rs5je4"; // RENEWAL_BOOK -> renews "compliance"
// A bare-slug module purchase ("field-crypto") that is NOT a bundle id — against this file's EMPTY
// registry index it grants fine at the entitlement-store layer (expandEntitlements is only a POST
// /issue VALIDATION step) but fails `expandEntitlements` (not indexed, not reserved, not a bundle)
// — the deliberate "unresolvable mint" fixture for the ADR-0292 failed-mint-never-fails-webhook test.
const PRICE_FIELD_CRYPTO_MODULE = "price_field_crypto_module_PLACEHOLDER";

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
  await tp.exec(CREDIT_ROUNDING_MIGRATION_SQL);
  await tp.exec(CREDIT_LINE_ITEM_MIGRATION_SQL);
  await tp.exec(CREDIT_EXPIRY_MIGRATION_SQL);
  await tp.exec(GRANT_CONSUMPTION_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_SCHEMA_SQL);
  await tp.exec(ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_CHARGED_AMOUNT_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_REFUNDED_AMOUNT_MIGRATION_SQL);
  await tp.exec(RENEWAL_EXTENSION_SCHEMA_SQL);
  await tp.exec(RENEWAL_EXTENSION_MONTHS_MIGRATION_SQL);
  await tp.exec(SUBSCRIPTION_STATUS_SCHEMA_SQL);
  await tp.exec(ORDER_RECORD_SCHEMA_SQL);
  await tp.exec(ORDER_RECORD_SUBSCRIPTION_LINK_MIGRATION_SQL);
  await tp.exec(ORDER_RECORD_DISCOUNT_MIGRATION_SQL); // ADR-0315 affiliate-attribution column
  await tp.exec(PROCESSED_EVENT_SCHEMA_SQL);
  await tp.exec(LICENSE_GRANT_SCHEMA_SQL);
  provider = createPaddleBilling({ webhookSecret: SECRET, apiKey: "pdl_test" });
});
afterAll(async () => {
  await tp.close();
});

function makeApp(
  p: BillingProvider | null,
  limiterConfig: RateLimitConfig = loadRateLimitConfig(),
  discordNotify: IssueAppDeps["discordNotify"] = null,
  posthogCapture: IssueAppDeps["posthogCapture"] = null,
  purchaseEmailNotify: IssueAppDeps["purchaseEmailNotify"] = async () => {},
  renewalEmailNotify: IssueAppDeps["renewalEmailNotify"] = async () => {},
  chargebackAlert: IssueAppDeps["chargebackAlert"] = async () => {},
  revokeEmailNotify: IssueAppDeps["revokeEmailNotify"] = async () => {},
  limiter: IssueAppDeps["limiter"] = new TokenBucketLimiter(limiterConfig),
  rateLimiterAlert: IssueAppDeps["rateLimiterAlert"] = async () => {},
): (req: Request) => Promise<Response> {
  return createApp({
    token: "unused-issue-token",
    signer,
    index,
    db: tp.pg,
    provider: p,
    limiter,
    discordNotify,
    posthogCapture,
    purchaseEmailNotify,
    renewalEmailNotify,
    revokeEmailNotify,
    chargebackAlert,
    rateLimiterAlert,
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
      "x-real-ip": ip, // the Railway edge-set, non-spoofable client IP the limiter keys on (vuln-0001)
      ...(signature !== null ? { "paddle-signature": signature } : {}),
    },
    body: rawBody,
  });
}

function oneTimeBody(eventId: string, txnId: string, priceId: string): string {
  // The FULL five-field envelope a real Paddle delivery carries (occurred_at + notification_id
  // included) — regression pin for the 2026-07-04 live-verification finding: the old strict
  // envelope schema 400'd every real webhook because the fixtures here were minimal three-field
  // envelopes that never exercised the documented shape.
  return JSON.stringify({
    event_id: eventId,
    event_type: "transaction.completed",
    occurred_at: "2026-07-04T00:00:00Z",
    notification_id: `ntf_${eventId}`,
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

  test("a retired edition-core price id (ADR-0238) returns non-2xx and grants NOTHING (stale sandbox redelivery)", async () => {
    // The four dropped edition-core rows' Paddle SANDBOX products still exist orphaned at Paddle;
    // a stale redelivery (or a stale persisted cart that slipped past pruneCart) must fail closed
    // through the FULL route: resolvePurchase throws ConfigError -> non-2xx so Paddle retries,
    // and neither an entitlement nor a credit lands. Pins the seam end to end, not by composition.
    const app = makeApp(provider);
    const acct = "acct_txn_retired_1";
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event_id: "evt_retired_1",
      event_type: "transaction.completed",
      data: {
        id: "txn_retired_1",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: "pri_01kwj6m31fxw5vn532h5ft6780" } }], // retired compliance_module row
        details: { totals: { grand_total: "29900" } },
      },
    });
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.status).toBeLessThan(600);
    const entitlements = await withTenant(tp.pg, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(entitlements).toEqual([]);
    expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(0);
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
      globalWebhook: { capacity: 100_000, windowMs: 60_000 },
      globalIssue: { capacity: 100_000, windowMs: 60_000 },
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

  test("a granting purchase fires the DETACHED discord push with the granted entitlements (ADR-0203)", async () => {
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

  test("a granting purchase fires the DETACHED posthog capture with revenue + entitlements (ADR-0237 F8)", async () => {
    const captures: PurchaseCapture[] = [];
    const app = makeApp(
      provider,
      loadRateLimitConfig(),
      null,
      async (capture) => {
        captures.push(capture); // records synchronously before its first await — visible right after app()
      },
    );
    const acct = "acct_txn_ph_1";
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event_id: "evt_ph_1",
      event_type: "transaction.completed",
      data: {
        id: "txn_ph_1",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: PRICE_COMPLIANCE_ONETIME } }],
        details: { totals: { grand_total: "74900" } },
      },
    });
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBe(200);
    expect(captures).toEqual([
      {
        accountId: acct,
        entitlements: ["compliance"],
        amountTotalMinor: 74900,
        currency: "usd",
        sourceEventId: "evt_ph_1",
        // SKU attribution: the compliance price -> canonical bundle id "compliance".
        skuLines: [
          { priceId: PRICE_COMPLIANCE_ONETIME, productSlug: "compliance" },
        ],
        // G33: a one-time purchase is never a subscription cycle.
        subscriptionCycle: false,
        // ADR-0320: no discount redeemed on this fixture -> null annotation.
        discountId: null,
      },
    ]);
  });

  test("a discounted purchase threads discount_id onto the posthog capture (ADR-0320)", async () => {
    const captures: PurchaseCapture[] = [];
    const app = makeApp(
      provider,
      loadRateLimitConfig(),
      null,
      async (capture) => {
        captures.push(capture);
      },
    );
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event_id: "evt_ph_disc_1",
      event_type: "transaction.completed",
      data: {
        id: "txn_ph_disc_1",
        subscription_id: null,
        discount_id: "dsc_affiliate_1",
        currency_code: "usd",
        custom_data: { account_id: "acct_txn_ph_disc_1" },
        items: [{ price: { id: PRICE_COMPLIANCE_ONETIME } }],
        details: { totals: { grand_total: "67410" } },
      },
    });
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBe(200);
    expect(captures).toHaveLength(1);
    expect(captures[0]?.discountId).toBe("dsc_affiliate_1");
  });

  test("G33: a subscription-CYCLE invoice captures with subscriptionCycle=true", async () => {
    const captures: PurchaseCapture[] = [];
    const app = makeApp(
      provider,
      loadRateLimitConfig(),
      null,
      async (capture) => {
        captures.push(capture);
      },
    );
    const acct = "acct_txn_ph_cycle";
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event_id: "evt_ph_cycle",
      event_type: "transaction.completed",
      data: {
        id: "txn_ph_cycle",
        subscription_id: "sub_ph_cycle",
        origin: "subscription_recurring",
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: PRICE_COMPLIANCE_UPDATES_SUB } }],
        details: { totals: { grand_total: "149900" } },
      },
    });
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBe(200);
    expect(captures.length).toBe(1);
    expect(captures[0]?.subscriptionCycle).toBe(true);
  });

  test("a THROWING posthog capturer never fails the webhook 2xx (money path independent of PostHog)", async () => {
    const app = makeApp(provider, loadRateLimitConfig(), null, () => {
      throw new Error("posthog ingest exploded synchronously");
    });
    const acct = "acct_txn_ph_2";
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event_id: "evt_ph_2",
      event_type: "transaction.completed",
      data: {
        id: "txn_ph_2",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: PRICE_COMPLIANCE_ONETIME } }],
        details: { totals: { grand_total: "74900" } },
      },
    });
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBe(200); // the grant committed; PostHog failure is log-and-drop
    const entitlements = await withTenant(tp.pg, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(entitlements).toEqual(["compliance"]);
  });

  test("a non-granting event (subscription.canceled) fires NO posthog capture", async () => {
    const captures: PurchaseCapture[] = [];
    const app = makeApp(
      provider,
      loadRateLimitConfig(),
      null,
      async (capture) => {
        captures.push(capture);
      },
    );
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event_id: "evt_ph_cancel",
      event_type: "subscription.canceled",
      data: {
        id: "sub_ph_cancel",
        custom_data: { account_id: "acct_txn_ph_1" },
      },
    });
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBe(200);
    expect(captures).toEqual([]);
  });

  test("a granting purchase fires the DETACHED purchase-confirmation email with the order + line", async () => {
    const notices: PurchaseEmailNotice[] = [];
    const app = makeApp(
      provider,
      loadRateLimitConfig(),
      null,
      null,
      async (notice) => {
        notices.push(notice); // records synchronously before its first await — visible right after app()
      },
    );
    const acct = "acct_txn_em_1";
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event_id: "evt_em_1",
      event_type: "transaction.completed",
      data: {
        id: "txn_em_1",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: PRICE_COMPLIANCE_ONETIME } }],
        details: { totals: { grand_total: "74900" } },
      },
    });
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBe(200);
    expect(notices.length).toBe(1);
    // ADR-0292: the post-commit first-mint token rides along on a granting delivery — asserted
    // separately (it is unique per run) so the rest of the receipt still pins byte-for-byte.
    const { licenseToken, ...rest } = notices[0]!;
    expect(typeof licenseToken).toBe("string");
    expect(licenseToken?.length).toBeGreaterThan(0);
    expect(rest).toEqual({
      accountId: acct,
      orderId: "evt_em_1",
      currency: "usd",
      amountTotalMinor: 74900,
      lines: [{ productSlug: "compliance" }],
      // A one-time purchase is never a subscription cycle (CAISSON-27).
      subscriptionCycle: false,
    });
  });

  test("a subscription-CYCLE invoice fires the receipt with subscriptionCycle=true (CAISSON-27)", async () => {
    const notices: PurchaseEmailNotice[] = [];
    const app = makeApp(
      provider,
      loadRateLimitConfig(),
      null,
      null,
      async (notice) => {
        notices.push(notice);
      },
    );
    const acct = "acct_txn_cycle_1";
    const t = Math.floor(Date.now() / 1000);
    // A subscription-linked transaction whose origin is `subscription_recurring` maps to
    // invoice.paid with billingReason "subscription_cycle" — the renewal-cycle receipt, not a
    // first-purchase one. The compliance_updates plan grants "compliance", so the gate fires.
    const body = JSON.stringify({
      event_id: "evt_cycle_1",
      event_type: "transaction.completed",
      data: {
        id: "txn_cycle_1",
        subscription_id: "sub_cycle_1",
        origin: "subscription_recurring",
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: PRICE_COMPLIANCE_UPDATES_SUB } }],
        details: { totals: { grand_total: "149900" } },
      },
    });
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBe(200);
    expect(notices.length).toBe(1);
    const { licenseToken, ...rest } = notices[0]!;
    expect(typeof licenseToken).toBe("string"); // ADR-0292 first-mint token
    expect(rest).toEqual({
      accountId: acct,
      orderId: "evt_cycle_1",
      currency: "usd",
      amountTotalMinor: 149900,
      lines: [{ productSlug: "compliance_updates" }],
      subscriptionCycle: true,
    });
  });

  test("a first subscription charge (subscription_create) fires the receipt with subscriptionCycle=false (CAISSON-27)", async () => {
    const notices: PurchaseEmailNotice[] = [];
    const app = makeApp(
      provider,
      loadRateLimitConfig(),
      null,
      null,
      async (notice) => {
        notices.push(notice);
      },
    );
    const acct = "acct_txn_first_sub_1";
    const t = Math.floor(Date.now() / 1000);
    // origin "web" -> billingReason "subscription_create": the FIRST charge reads as a first
    // purchase, never the recurring-payment variant.
    const body = JSON.stringify({
      event_id: "evt_first_sub_1",
      event_type: "transaction.completed",
      data: {
        id: "txn_first_sub_1",
        subscription_id: "sub_first_1",
        origin: "web",
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: PRICE_COMPLIANCE_UPDATES_SUB } }],
        details: { totals: { grand_total: "149900" } },
      },
    });
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBe(200);
    expect(notices[0]?.subscriptionCycle).toBe(false);
  });

  test("a THROWING purchase-confirmation emailer never fails the webhook 2xx (money path independent of email)", async () => {
    const app = makeApp(provider, loadRateLimitConfig(), null, null, () => {
      throw new Error("email transport exploded synchronously");
    });
    const acct = "acct_txn_em_2";
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event_id: "evt_em_2",
      event_type: "transaction.completed",
      data: {
        id: "txn_em_2",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: PRICE_COMPLIANCE_ONETIME } }],
        details: { totals: { grand_total: "74900" } },
      },
    });
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBe(200); // the grant committed; email failure is log-and-drop
    const entitlements = await withTenant(tp.pg, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(entitlements).toEqual(["compliance"]);
  });

  test("a non-granting event (subscription.canceled) fires NO purchase-confirmation email", async () => {
    const notices: PurchaseEmailNotice[] = [];
    const app = makeApp(
      provider,
      loadRateLimitConfig(),
      null,
      null,
      async (notice) => {
        notices.push(notice);
      },
    );
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event_id: "evt_em_cancel",
      event_type: "subscription.canceled",
      data: {
        id: "sub_em_cancel",
        custom_data: { account_id: "acct_txn_em_1" },
      },
    });
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBe(200);
    expect(notices).toEqual([]);
  });

  test("a renewal-only event fires the DETACHED renewal-confirmation email, NOT the purchase-confirmation email (ADR-0251)", async () => {
    const acct = "acct_txn_ren_1";
    // Precondition: an active one-time compliance grant to renew.
    const baseApp = makeApp(provider);
    const baseBody = JSON.stringify({
      event_id: "evt_ren_base_1",
      event_type: "transaction.completed",
      data: {
        id: "txn_ren_base_1",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: PRICE_COMPLIANCE_ONETIME } }],
        details: { totals: { grand_total: "74900" } },
      },
    });
    const baseT = Math.floor(Date.now() / 1000);
    const baseRes = await baseApp(
      webhookReq(baseBody, signed(baseBody, baseT)),
    );
    expect(baseRes.status).toBe(200);

    const purchaseNotices: PurchaseEmailNotice[] = [];
    const renewalNotices: RenewalEmailNotice[] = [];
    const app = makeApp(
      provider,
      loadRateLimitConfig(),
      null,
      null,
      async (notice) => {
        purchaseNotices.push(notice);
      },
      async (notice) => {
        renewalNotices.push(notice); // records synchronously before its first await
      },
    );
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event_id: "evt_ren_1",
      event_type: "transaction.completed",
      data: {
        id: "txn_ren_1",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: PRICE_COMPLIANCE_RENEWAL } }],
        details: { totals: { grand_total: "29900" } },
      },
    });
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBe(200);
    expect(purchaseNotices).toEqual([]); // a renewal grants nothing → no purchase receipt
    expect(renewalNotices.length).toBe(1);
    expect(renewalNotices[0]?.accountId).toBe(acct);
    expect(renewalNotices[0]?.orderId).toBe("evt_ren_1");
    expect(renewalNotices[0]?.currency).toBe("usd");
    expect(renewalNotices[0]?.amountTotalMinor).toBe(29900);
    expect(renewalNotices[0]?.lines.length).toBe(1);
    expect(renewalNotices[0]?.lines[0]?.entitlementId).toBe("compliance");
    // A full ISO instant (computeUpdatesWindows' `.toISOString()`), post-extension DB truth.
    expect(renewalNotices[0]?.lines[0]?.newWindowEnd).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    );
  });

  test("a MIXED cart fires BOTH emails, and only the purchase receipt carries the total", async () => {
    const acct = "acct_txn_ren_mix";
    // Precondition: an active one-time compliance grant to renew.
    const baseApp = makeApp(provider);
    const baseBody = JSON.stringify({
      event_id: "evt_ren_mix_base",
      event_type: "transaction.completed",
      data: {
        id: "txn_ren_mix_base",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: PRICE_COMPLIANCE_ONETIME } }],
        details: { totals: { grand_total: "74900" } },
      },
    });
    const baseT = Math.floor(Date.now() / 1000);
    expect(
      (await baseApp(webhookReq(baseBody, signed(baseBody, baseT)))).status,
    ).toBe(200);

    const purchaseNotices: PurchaseEmailNotice[] = [];
    const renewalNotices: RenewalEmailNotice[] = [];
    const app = makeApp(
      provider,
      loadRateLimitConfig(),
      null,
      null,
      async (notice) => {
        purchaseNotices.push(notice);
      },
      async (notice) => {
        renewalNotices.push(notice);
      },
    );
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event_id: "evt_ren_mix_1",
      event_type: "transaction.completed",
      data: {
        id: "txn_ren_mix_1",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [
          { price: { id: PRICE_COMPLIANCE_ONETIME } },
          { price: { id: PRICE_COMPLIANCE_RENEWAL } },
        ],
        // A MULTI-line transaction fails closed without per-line `details.line_items` join ids
        // (billing-orchestration's dropped-paid-line guard) — a real Paddle delivery carries them.
        details: {
          totals: { grand_total: "104800" },
          line_items: [
            {
              id: "txnitm_mix_pur",
              price_id: PRICE_COMPLIANCE_ONETIME,
              totals: { total: "74900" },
            },
            {
              id: "txnitm_mix_ren",
              price_id: PRICE_COMPLIANCE_RENEWAL,
              totals: { total: "29900" },
            },
          ],
        },
      },
    });
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBe(200);
    // The purchase receipt states the whole-event total; the renewal notice omits it — two
    // emails each claiming the full cart total would read as a double charge.
    expect(purchaseNotices.length).toBe(1);
    expect(purchaseNotices[0]?.amountTotalMinor).toBe(104800);
    expect(renewalNotices.length).toBe(1);
    expect(renewalNotices[0]?.amountTotalMinor).toBeUndefined();
    expect(renewalNotices[0]?.lines[0]?.entitlementId).toBe("compliance");
  });

  test("a THROWING renewal-confirmation emailer never fails the webhook 2xx (money path independent of email)", async () => {
    const acct = "acct_txn_ren_2";
    const baseApp = makeApp(provider);
    const baseBody = JSON.stringify({
      event_id: "evt_ren_base_2",
      event_type: "transaction.completed",
      data: {
        id: "txn_ren_base_2",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: PRICE_COMPLIANCE_ONETIME } }],
        details: { totals: { grand_total: "74900" } },
      },
    });
    const baseT = Math.floor(Date.now() / 1000);
    const baseRes = await baseApp(
      webhookReq(baseBody, signed(baseBody, baseT)),
    );
    expect(baseRes.status).toBe(200);

    const app = makeApp(
      provider,
      loadRateLimitConfig(),
      null,
      null,
      async () => {},
      () => {
        throw new Error("email transport exploded synchronously");
      },
    );
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event_id: "evt_ren_2",
      event_type: "transaction.completed",
      data: {
        id: "txn_ren_2",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: PRICE_COMPLIANCE_RENEWAL } }],
        details: { totals: { grand_total: "29900" } },
      },
    });
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBe(200); // the window extension committed; email failure is log-and-drop
    const entitlements = await withTenant(tp.pg, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(entitlements).toEqual(["compliance"]);
  });

  test("a non-renewal purchase does NOT fire the renewal-confirmation email", async () => {
    const renewalNotices: RenewalEmailNotice[] = [];
    const app = makeApp(
      provider,
      loadRateLimitConfig(),
      null,
      null,
      async () => {},
      async (notice) => {
        renewalNotices.push(notice);
      },
    );
    const acct = "acct_txn_ren_3";
    const t = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event_id: "evt_ren_3",
      event_type: "transaction.completed",
      data: {
        id: "txn_ren_3",
        subscription_id: null,
        currency_code: "usd",
        custom_data: { account_id: acct },
        items: [{ price: { id: PRICE_COMPLIANCE_ONETIME } }],
        details: { totals: { grand_total: "74900" } },
      },
    });
    const res = await app(webhookReq(body, signed(body, t)));
    expect(res.status).toBe(200);
    expect(renewalNotices).toEqual([]);
  });

  test("a per-IP flood on /issue is capped with 429 (limiter runs before the bearer check)", async () => {
    const app = makeApp(provider, {
      webhook: { capacity: 1, windowMs: 60_000 },
      issue: { capacity: 1, windowMs: 60_000 },
      globalWebhook: { capacity: 100_000, windowMs: 60_000 },
      globalIssue: { capacity: 100_000, windowMs: 60_000 },
      maxEntries: 100,
    });
    const issueReq = (): Request =>
      new Request("http://license.test/issue", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-real-ip": "8.8.8.8",
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

  for (const stage of ["check", "checkGlobal"] as const) {
    test(`/webhook fails open and alerts when limiter ${stage} throws`, async () => {
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
      const app = makeApp(
        provider,
        loadRateLimitConfig(),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        limiter,
        async (alert) => {
          alerts.push(alert);
        },
      );

      // The limiter failure must not make the webhook unavailable. It proceeds to the independent
      // HMAC boundary, where this deliberately unsigned request still fails closed.
      const response = await app(webhookReq("{}", null));

      expect(response.status).toBe(401);
      expect(alerts).toEqual([{ bucket: "webhook", failureMode: "open" }]);
    });
  }

  test("rotating x-envoy-external-address does not mint a fresh /issue bucket (Strix vuln-0001)", async () => {
    // The exact pentest bypass: rotate the spoofable header on every request (no trusted X-Real-IP
    // present). clientIp no longer trusts x-envoy-external-address / x-forwarded-for, so all requests
    // collapse onto the shared "unknown" bucket and the second is throttled.
    const app = makeApp(provider, {
      webhook: { capacity: 1, windowMs: 60_000 },
      issue: { capacity: 1, windowMs: 60_000 },
      globalWebhook: { capacity: 100_000, windowMs: 60_000 },
      globalIssue: { capacity: 100_000, windowMs: 60_000 },
      maxEntries: 100,
    });
    const issueReq = (fakeIp: string): Request =>
      new Request("http://license.test/issue", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-envoy-external-address": fakeIp,
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
    expect(second.status).toBe(429); // spoofable header ignored → same "unknown" bucket → throttled
  });

  describe("ADR-0292: license first-mint webhook-push", () => {
    test("a granting purchase mints a license post-commit, persisted for (account, major 0)", async () => {
      const app = makeApp(provider);
      const acct = "acct_txn_mint_persist";
      const t = Math.floor(Date.now() / 1000);
      const body = JSON.stringify({
        event_id: "evt_mint_persist",
        event_type: "transaction.completed",
        data: {
          id: "txn_mint_persist",
          subscription_id: null,
          currency_code: "usd",
          custom_data: { account_id: acct },
          items: [{ price: { id: PRICE_COMPLIANCE_ONETIME } }],
          details: { totals: { grand_total: "74900" } },
        },
      });
      const res = await app(webhookReq(body, signed(body, t)));
      expect(res.status).toBe(200);
      const grant = await withTenant(tp.pg, acct, (tx) =>
        readLicenseGrant(tx, acct, 0),
      );
      expect(grant).not.toBeNull();
      expect(grant?.token.length).toBeGreaterThan(0);
    });

    test("a re-delivery (same event_id) mints no second grant — one row per (account, major)", async () => {
      const app = makeApp(provider);
      const acct = "acct_txn_mint_redelivery";
      const t = Math.floor(Date.now() / 1000);
      const body = JSON.stringify({
        event_id: "evt_mint_redelivery",
        event_type: "transaction.completed",
        data: {
          id: "txn_mint_redelivery",
          subscription_id: null,
          currency_code: "usd",
          custom_data: { account_id: acct },
          items: [{ price: { id: PRICE_COMPLIANCE_ONETIME } }],
          details: { totals: { grand_total: "74900" } },
        },
      });
      const sig = signed(body, t);
      const first = await app(webhookReq(body, sig));
      expect(first.status).toBe(200);
      const firstGrant = await withTenant(tp.pg, acct, (tx) =>
        readLicenseGrant(tx, acct, 0),
      );
      expect(firstGrant).not.toBeNull();

      const replay = await app(webhookReq(body, sig));
      expect(replay.status).toBe(200);
      const afterReplay = await withTenant(tp.pg, acct, (tx) =>
        readLicenseGrant(tx, acct, 0),
      );
      // Same row, byte-identical token (idempotent re-serve, ADR-0110 "persist & reuse").
      expect(afterReplay?.id).toBe(firstGrant?.id);
      expect(afterReplay?.token).toBe(firstGrant?.token);
    });

    test("a Paddle Resend (fresh event_id, same transaction) re-serves the SAME stored token, not a second row", async () => {
      const app = makeApp(provider);
      const acct = "acct_txn_mint_resend";
      const t1 = Math.floor(Date.now() / 1000);
      const bodyA = oneTimeBody(
        "evt_mint_resend_a",
        "txn_mint_resend",
        PRICE_COMPLIANCE_ONETIME,
      );
      const resA = await app(webhookReq(bodyA, signed(bodyA, t1)));
      expect(resA.status).toBe(200);
      const grantA = await withTenant(tp.pg, acct, (tx) =>
        readLicenseGrant(tx, acct, 0),
      );
      expect(grantA).not.toBeNull();

      // Same underlying transaction id, FRESH event_id — models the Paddle dashboard "Resend"
      // (the DB grant no-ops via G7's per-invoice/per-payment claim; the mint's OWN idempotent
      // re-serve additionally guarantees byte-identical output even if it ran again).
      const t2 = t1 + 1;
      const bodyB = oneTimeBody(
        "evt_mint_resend_b",
        "txn_mint_resend",
        PRICE_COMPLIANCE_ONETIME,
      );
      const resB = await app(webhookReq(bodyB, signed(bodyB, t2)));
      expect(resB.status).toBe(200);
      const grantB = await withTenant(tp.pg, acct, (tx) =>
        readLicenseGrant(tx, acct, 0),
      );
      expect(grantB?.id).toBe(grantA?.id);
      expect(grantB?.token).toBe(grantA?.token);
    });

    test("a failed mint (unresolvable entitlement) never fails the webhook 200, and the email sends without a token", async () => {
      const notices: PurchaseEmailNotice[] = [];
      const app = makeApp(
        provider,
        loadRateLimitConfig(),
        null,
        null,
        async (notice) => {
          notices.push(notice);
        },
      );
      const acct = "acct_txn_mint_fail";
      const t = Math.floor(Date.now() / 1000);
      // field-crypto is a bare module slug, not a bundle — against this file's EMPTY index it
      // grants fine at the entitlement-store layer but fails expandEntitlements's VALIDATION
      // (not indexed, not reserved, not a bundle), so issueOrReuseLicense returns "unresolved".
      const body = oneTimeBody(
        "evt_mint_fail",
        "txn_mint_fail",
        PRICE_FIELD_CRYPTO_MODULE,
      );
      const res = await app(webhookReq(body, signed(body, t)));
      expect(res.status).toBe(200); // the grant already committed — never a Paddle retry
      const entitlements = await withTenant(tp.pg, acct, (tx) =>
        readEntitlements(tx, acct),
      );
      expect(entitlements).toEqual(["field-crypto"]); // the grant landed regardless
      const grant = await withTenant(tp.pg, acct, (tx) =>
        readLicenseGrant(tx, acct, 0),
      );
      expect(grant).toBeNull(); // no license persisted — the failed mint is self-healing, not fatal
      expect(notices.length).toBe(1);
      expect(notices[0]?.licenseToken).toBeUndefined(); // receipt still sends, just without a token
    });

    test("IN-02 (PR #177 review): a hung signer is bounded by the mint deadline — the webhook still responds 200 within it", async () => {
      // Models a future KMS-backed Signer whose `sign` round trip stalls (network partition, KMS
      // outage) — never resolves, never rejects. Without a deadline this would hang the whole
      // AWAITED post-commit mint indefinitely, risking Paddle's own webhook timeout on an ALREADY
      // durably-committed grant. `publicKey` is unused by `issueLicense` (only `sign` is called) but
      // resolves normally to keep the double realistic.
      const hangingSigner: Signer = {
        keyId: "hang-test",
        algorithm: "ed25519",
        publicKey: () => Promise.resolve(new Uint8Array(32)),
        sign: () => new Promise<Uint8Array>(() => {}),
      };
      const notices: PurchaseEmailNotice[] = [];
      const app = createApp({
        token: "unused-issue-token",
        signer: hangingSigner,
        index,
        db: tp.pg,
        provider,
        limiter: new TokenBucketLimiter(loadRateLimitConfig()),
        discordNotify: null,
        posthogCapture: null,
        purchaseEmailNotify: async (notice) => {
          notices.push(notice);
        },
        renewalEmailNotify: async () => {},
        revokeEmailNotify: async () => {},
        chargebackAlert: async () => {},
        rateLimiterAlert: async () => {},
      });
      const acct = "acct_txn_mint_hang";
      const t = Math.floor(Date.now() / 1000);
      const body = oneTimeBody(
        "evt_mint_hang",
        "txn_mint_hang",
        PRICE_COMPLIANCE_ONETIME,
      );
      const started = Date.now();
      const res = await app(webhookReq(body, signed(body, t)));
      const elapsed = Date.now() - started;
      expect(res.status).toBe(200); // the grant already committed — a hung signer never fails/blocks it
      // Bounded near MINT_POST_COMMIT_TIMEOUT_MS (5s) plus normal DB round trips — proves the
      // deadline actually fired rather than the signer promise hanging until the test's own 30s
      // budget (or forever, in a real deployment).
      expect(elapsed).toBeGreaterThanOrEqual(4_900);
      expect(elapsed).toBeLessThan(15_000);
      const entitlements = await withTenant(tp.pg, acct, (tx) =>
        readEntitlements(tx, acct),
      );
      expect(entitlements).toEqual(["compliance"]); // the grant landed regardless of the mint outcome
      const grant = await withTenant(tp.pg, acct, (tx) =>
        readLicenseGrant(tx, acct, 0),
      );
      expect(grant).toBeNull(); // no license persisted — the timed-out mint is self-healing, not fatal
      expect(notices.length).toBe(1);
      expect(notices[0]?.licenseToken).toBeUndefined(); // receipt still sends, just without a token
    });

    test("G7: a Resend (fresh event_id, same transaction) does not double-fire the purchase-confirmation email", async () => {
      const notices: PurchaseEmailNotice[] = [];
      const app = makeApp(
        provider,
        loadRateLimitConfig(),
        null,
        null,
        async (notice) => {
          notices.push(notice);
        },
      );
      const t1 = Math.floor(Date.now() / 1000);
      const bodyA = oneTimeBody(
        "evt_g7_email_a",
        "txn_g7_email",
        PRICE_COMPLIANCE_ONETIME,
      );
      expect((await app(webhookReq(bodyA, signed(bodyA, t1)))).status).toBe(
        200,
      );
      expect(notices.length).toBe(1);

      const t2 = t1 + 1;
      const bodyB = oneTimeBody(
        "evt_g7_email_b",
        "txn_g7_email",
        PRICE_COMPLIANCE_ONETIME,
      );
      expect((await app(webhookReq(bodyB, signed(bodyB, t2)))).status).toBe(
        200,
      );
      // The resend's grant/credit writes no-op at the DB layer (G7's per-payment claim), so the
      // notify gate sees an empty grantedEntitlements list — no second receipt.
      expect(notices.length).toBe(1);
    });

    test("G7: a Resend does not double-fire the discord push or the posthog capture either", async () => {
      const pushes: Array<{ accountId: string; entitlements: string[] }> = [];
      const captures: PurchaseCapture[] = [];
      const app = makeApp(
        provider,
        loadRateLimitConfig(),
        async (push) => {
          pushes.push(push);
        },
        async (capture) => {
          captures.push(capture);
        },
      );
      const t1 = Math.floor(Date.now() / 1000);
      const bodyA = oneTimeBody(
        "evt_g7_fanout_a",
        "txn_g7_fanout",
        PRICE_COMPLIANCE_ONETIME,
      );
      expect((await app(webhookReq(bodyA, signed(bodyA, t1)))).status).toBe(
        200,
      );
      const t2 = t1 + 1;
      const bodyB = oneTimeBody(
        "evt_g7_fanout_b",
        "txn_g7_fanout",
        PRICE_COMPLIANCE_ONETIME,
      );
      expect((await app(webhookReq(bodyB, signed(bodyB, t2)))).status).toBe(
        200,
      );
      expect(pushes.length).toBe(1);
      expect(captures.length).toBe(1);
    });
  });

  describe("ADR-0294: chargeback subscribe + alert-only", () => {
    function chargebackBody(
      eventId: string,
      txnId: string,
      accountId: string,
    ): string {
      return JSON.stringify({
        event_id: eventId,
        event_type: "adjustment.created",
        data: {
          id: `adj_${eventId}`,
          action: "chargeback",
          transaction_id: txnId,
          currency_code: "usd",
          custom_data: { account_id: accountId },
          totals: { total: "74900" },
        },
      });
    }

    test("a chargeback alerts the operator and grants/revokes/claws nothing", async () => {
      const alerts: ChargebackAlert[] = [];
      const app = makeApp(
        provider,
        loadRateLimitConfig(),
        null,
        null,
        async () => {},
        async () => {},
        async (alert) => {
          alerts.push(alert);
        },
      );
      const acct = "acct_txn_chargeback_1";
      const t = Math.floor(Date.now() / 1000);
      const body = chargebackBody("evt_chargeback_1", "txn_chargeback_1", acct);
      const res = await app(webhookReq(body, signed(body, t)));
      expect(res.status).toBe(200);
      expect(alerts).toEqual([
        {
          accountId: acct,
          paymentId: "txn_chargeback_1",
          amountDisputed: 74900,
          currency: "usd",
        },
      ]);
      // ALERT-ONLY: no entitlement, no credit movement for an account that never purchased anything.
      const entitlements = await withTenant(tp.pg, acct, (tx) =>
        readEntitlements(tx, acct),
      );
      expect(entitlements).toEqual([]);
      expect(await withTenant(tp.pg, acct, (tx) => balance(tx, acct))).toBe(0);
    });

    test("WR-01: a Resend (fresh event_id, same disputed transaction) alerts the operator only ONCE", async () => {
      const alerts: ChargebackAlert[] = [];
      const app = makeApp(
        provider,
        loadRateLimitConfig(),
        null,
        null,
        async () => {},
        async () => {},
        async (alert) => {
          alerts.push(alert);
        },
      );
      const acct = "acct_txn_chargeback_resend";
      const t1 = Math.floor(Date.now() / 1000);
      const bodyA = chargebackBody(
        "evt_chargeback_resend_a",
        "txn_chargeback_resend",
        acct,
      );
      expect((await app(webhookReq(bodyA, signed(bodyA, t1)))).status).toBe(
        200,
      );
      // Same dispute, FRESH event_id — models the Paddle dashboard "Resend" (the exact G7 shape).
      const t2 = t1 + 1;
      const bodyB = chargebackBody(
        "evt_chargeback_resend_b",
        "txn_chargeback_resend",
        acct,
      );
      expect((await app(webhookReq(bodyB, signed(bodyB, t2)))).status).toBe(
        200,
      );
      expect(alerts.length).toBe(1);
    });

    test("a THROWING chargeback alerter never fails the webhook 2xx", async () => {
      const app = makeApp(
        provider,
        loadRateLimitConfig(),
        null,
        null,
        async () => {},
        async () => {},
        () => {
          throw new Error("alert transport exploded synchronously");
        },
      );
      const t = Math.floor(Date.now() / 1000);
      const body = chargebackBody(
        "evt_chargeback_throw",
        "txn_chargeback_throw",
        "acct_txn_chargeback_2",
      );
      const res = await app(webhookReq(body, signed(body, t)));
      expect(res.status).toBe(200);
    });

    test("a non-chargeback adjustment.created (a refund's own pending creation) is a no-op, unchanged", async () => {
      const alerts: ChargebackAlert[] = [];
      const app = makeApp(
        provider,
        loadRateLimitConfig(),
        null,
        null,
        async () => {},
        async () => {},
        async (alert) => {
          alerts.push(alert);
        },
      );
      const t = Math.floor(Date.now() / 1000);
      const body = JSON.stringify({
        event_id: "evt_adj_created_refund",
        event_type: "adjustment.created",
        data: {
          id: "adj_refund_pending",
          action: "refund",
          status: "pending_approval",
          transaction_id: "txn_adj_created_refund",
          currency_code: "usd",
          custom_data: { account_id: "acct_txn_chargeback_3" },
          totals: { total: "5000" },
        },
      });
      const res = await app(webhookReq(body, signed(body, t)));
      expect(res.status).toBe(200);
      expect(alerts).toEqual([]);
    });
  });

  describe("G27: cancel/refund buyer-facing notification", () => {
    function makeAppWithRevoke(
      revokeEmailNotify: IssueAppDeps["revokeEmailNotify"],
    ): (req: Request) => Promise<Response> {
      return makeApp(
        provider,
        loadRateLimitConfig(),
        null,
        null,
        async () => {},
        async () => {},
        async () => {},
        revokeEmailNotify,
      );
    }

    test("a subscription cancel fires the revoke notice (reason: subscription_canceled)", async () => {
      const notices: RevokeEmailNotice[] = [];
      const acct = "acct_g27_cancel";
      // Precondition: an active subscription grant to cancel.
      const baseApp = makeApp(provider);
      const baseT = Math.floor(Date.now() / 1000);
      const baseBody = JSON.stringify({
        event_id: "evt_g27_cancel_base",
        event_type: "transaction.completed",
        data: {
          id: "txn_g27_cancel_base",
          subscription_id: "sub_g27_cancel",
          origin: "web",
          currency_code: "usd",
          custom_data: { account_id: acct },
          items: [{ price: { id: PRICE_COMPLIANCE_UPDATES_SUB } }],
          details: { totals: { grand_total: "149900" } },
        },
      });
      expect(
        (await baseApp(webhookReq(baseBody, signed(baseBody, baseT)))).status,
      ).toBe(200);

      const app = makeAppWithRevoke(async (notice) => {
        notices.push(notice);
      });
      const t = Math.floor(Date.now() / 1000);
      const body = JSON.stringify({
        event_id: "evt_g27_cancel",
        event_type: "subscription.canceled",
        data: { id: "sub_g27_cancel", custom_data: { account_id: acct } },
      });
      const res = await app(webhookReq(body, signed(body, t)));
      expect(res.status).toBe(200);
      expect(notices).toEqual([
        { accountId: acct, reason: "subscription_canceled" },
      ]);
    });

    test("a redelivered cancel (same event_id) does not double-fire the revoke notice", async () => {
      const notices: RevokeEmailNotice[] = [];
      const acct = "acct_g27_cancel_redelivery";
      const baseApp = makeApp(provider);
      const baseT = Math.floor(Date.now() / 1000);
      const baseBody = JSON.stringify({
        event_id: "evt_g27_cancel_redel_base",
        event_type: "transaction.completed",
        data: {
          id: "txn_g27_cancel_redel_base",
          subscription_id: "sub_g27_cancel_redel",
          origin: "web",
          currency_code: "usd",
          custom_data: { account_id: acct },
          items: [{ price: { id: PRICE_COMPLIANCE_UPDATES_SUB } }],
          details: { totals: { grand_total: "149900" } },
        },
      });
      expect(
        (await baseApp(webhookReq(baseBody, signed(baseBody, baseT)))).status,
      ).toBe(200);

      const app = makeAppWithRevoke(async (notice) => {
        notices.push(notice);
      });
      const t = Math.floor(Date.now() / 1000);
      const body = JSON.stringify({
        event_id: "evt_g27_cancel_redel",
        event_type: "subscription.canceled",
        data: {
          id: "sub_g27_cancel_redel",
          custom_data: { account_id: acct },
        },
      });
      const sig = signed(body, t);
      expect((await app(webhookReq(body, sig))).status).toBe(200);
      expect((await app(webhookReq(body, sig))).status).toBe(200);
      expect(notices.length).toBe(1);
    });

    test("a whole-transaction refund fires the revoke notice (reason: refund)", async () => {
      const notices: RevokeEmailNotice[] = [];
      // oneTimeBody derives custom_data.account_id as `acct_${txnId}` — match it here rather
      // than passing a mismatched account to the refund event below.
      const acct = "acct_txn_g27_refund";
      const baseApp = makeApp(provider);
      const baseT = Math.floor(Date.now() / 1000);
      const baseBody = oneTimeBody(
        "evt_g27_refund_base",
        "txn_g27_refund",
        PRICE_COMPLIANCE_ONETIME,
      );
      expect(
        (await baseApp(webhookReq(baseBody, signed(baseBody, baseT)))).status,
      ).toBe(200);

      const app = makeAppWithRevoke(async (notice) => {
        notices.push(notice);
      });
      const t = Math.floor(Date.now() / 1000);
      const body = JSON.stringify({
        event_id: "evt_g27_refund",
        event_type: "adjustment.updated",
        data: {
          id: "adj_g27_refund",
          action: "refund",
          status: "approved",
          type: "full",
          transaction_id: "txn_g27_refund",
          currency_code: "usd",
          custom_data: { account_id: acct },
          totals: { total: "74900" },
        },
      });
      const res = await app(webhookReq(body, signed(body, t)));
      expect(res.status).toBe(200);
      expect(notices).toEqual([{ accountId: acct, reason: "refund" }]);
    });

    test("a dollar-PARTIAL refund with NO entitlement loss fires no revoke notice", async () => {
      const notices: RevokeEmailNotice[] = [];
      const acct = "acct_txn_g27_partial"; // matches oneTimeBody's derived account_id
      const baseApp = makeApp(provider);
      const baseT = Math.floor(Date.now() / 1000);
      const baseBody = oneTimeBody(
        "evt_g27_partial_base",
        "txn_g27_partial",
        PRICE_CREDIT_PACK,
      );
      expect(
        (await baseApp(webhookReq(baseBody, signed(baseBody, baseT)))).status,
      ).toBe(200);

      const app = makeAppWithRevoke(async (notice) => {
        notices.push(notice);
      });
      const t = Math.floor(Date.now() / 1000);
      // A dollar-partial adjustment (fullyRefunded:false whole-tx, item type:'partial') claws
      // credits only — no entitlement grant is ever revoked, so no "access changed" notice fires.
      const body = JSON.stringify({
        event_id: "evt_g27_partial",
        event_type: "adjustment.updated",
        data: {
          id: "adj_g27_partial",
          action: "refund",
          status: "approved",
          type: "partial",
          transaction_id: "txn_g27_partial",
          currency_code: "usd",
          custom_data: { account_id: acct },
          totals: { total: "1000" },
          items: [
            {
              id: "adjitm_g27_partial",
              item_id: "",
              type: "partial",
              totals: { total: "1000" },
            },
          ],
        },
      });
      const res = await app(webhookReq(body, signed(body, t)));
      expect(res.status).toBe(200);
      expect(notices).toEqual([]);
    });

    test("a THROWING revoke-notice emailer never fails the webhook 2xx", async () => {
      const acct = "acct_txn_g27_throw"; // matches oneTimeBody's derived account_id
      const baseApp = makeApp(provider);
      const baseT = Math.floor(Date.now() / 1000);
      const baseBody = oneTimeBody(
        "evt_g27_throw_base",
        "txn_g27_throw",
        PRICE_COMPLIANCE_ONETIME,
      );
      expect(
        (await baseApp(webhookReq(baseBody, signed(baseBody, baseT)))).status,
      ).toBe(200);

      const app = makeAppWithRevoke(() => {
        throw new Error("email transport exploded synchronously");
      });
      const t = Math.floor(Date.now() / 1000);
      const body = JSON.stringify({
        event_id: "evt_g27_throw",
        event_type: "adjustment.updated",
        data: {
          id: "adj_g27_throw",
          action: "refund",
          status: "approved",
          type: "full",
          transaction_id: "txn_g27_throw",
          currency_code: "usd",
          custom_data: { account_id: acct },
          totals: { total: "74900" },
        },
      });
      const res = await app(webhookReq(body, signed(body, t)));
      expect(res.status).toBe(200);
    });
  });
});
