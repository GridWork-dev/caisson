// live/webhook-grant.live.test.ts — the LIVE Paddle webhook → GRANT-ROW proof (seam 1, ADR-0224
// F1/F2=A). The billing-package leg (packages/billing/live/paddle-webhook.live.test.ts) proves the
// VERIFIER against a real Paddle-generated signature; THIS leg proves the piece only a real DB
// round-trip can vouch for: a correctly-signed `transaction.completed` for the reserved proof account,
// put through the DEPLOYED /webhook (real license.caisson.sh, real PADDLE_WEBHOOK_SECRET, real Railway
// PG), durably writes a real entitlement_grant (+ credit) row — then tears it down. A rotated webhook
// secret, a wrong-scoped DB credential, or a broken deployed wiring passes every double-backed unit
// test and fails HERE.
//
// The delivery is signed by the test with the REAL webhook secret using Paddle's own documented
// `${ts}:${rawBody}` HMAC scheme (paddle-webhook.ts) — the same shape a genuine Paddle delivery
// carries — so the deployed verify→parse→applyBillingEvent chain runs end-to-end. The synthetic part
// (we generate the signature, not Paddle) is exactly what the billing leg's real-signature simulator
// covers; this leg's job is the grant ROW.
//
// ADR-0201 convention: lives OUTSIDE ./src (default suite / CI / tarball never see it) AND self-skips
// without PADDLE_WEBHOOK_SECRET + DATABASE_URL + LICENSE_WEBHOOK_URL + PADDLE_PROOF_PRICE_ID. Reserved
// proof tenant + a per-run txn id so concurrent runs never collide on the ledger idempotency key.
import { afterAll, describe, expect, test } from "bun:test";
import { createHmac, randomUUID } from "node:crypto";
import { fetchWithTimeout } from "@caisson/kernel";
import {
  createPgPool,
  createPgTransactor,
  withTenant,
} from "@caisson/tenancy-rls";

const WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET ?? "";
const DATABASE_URL = process.env.DATABASE_URL ?? "";
const WEBHOOK_URL = process.env.LICENSE_WEBHOOK_URL ?? ""; // e.g. https://license.caisson.sh/webhook
// A real purchasable price id the DEPLOYED pricebook resolves (resolvePurchase is fail-closed on an
// unknown id → the grant throws → 500). The operator supplies a sandbox price that grants an entitlement.
const PROOF_PRICE_ID = process.env.PADDLE_PROOF_PRICE_ID ?? "";

const HAVE_CREDS =
  WEBHOOK_SECRET.length > 0 &&
  DATABASE_URL.length > 0 &&
  WEBHOOK_URL.length > 0 &&
  PROOF_PRICE_ID.length > 0;
const liveTest = test.skipIf(!HAVE_CREDS);
const TIMEOUT = 30_000;

/** The reserved live-proof tenant (shared with the WORM proof, ADR-0201) — a fixed UUID outside any
 *  real account space, so a grant row here is never a real customer's. */
const PROOF_ACCOUNT_ID = "00000000-0000-4000-8000-00000000c0de";
/** Fresh per-run anchor: the payment/txn id is the ledger idempotency key, so a re-run must not reuse it. */
const RUN = randomUUID();
const PAYMENT_ID = `txn_proof_${RUN}`;

// Only build the pool when creds are present — the credential-less skip run has zero side effects.
// The Pool→Transactor adapter is tenancy-rls's canonical `createPgTransactor` (C05).
const pool = HAVE_CREDS ? createPgPool(DATABASE_URL) : null;
const db = pool ? createPgTransactor(pool) : null;

/** A minimal but valid one-time `transaction.completed` for the proof account + proof price. */
function proofPayload(): string {
  return JSON.stringify({
    event_id: `evt_proof_${RUN}`,
    event_type: "transaction.completed",
    data: {
      id: PAYMENT_ID,
      currency_code: "USD",
      custom_data: { account_id: PROOF_ACCOUNT_ID },
      items: [{ price: { id: PROOF_PRICE_ID }, quantity: 1 }],
      details: {
        totals: { grand_total: "4900" },
        line_items: [
          {
            id: `txnitm_proof_${RUN}`,
            price_id: PROOF_PRICE_ID,
            totals: { total: "4900" },
          },
        ],
      },
    },
  });
}

/** Sign exactly as paddle-webhook.ts verifies: `ts=<unix>;h1=<hmac(secret, `${ts}:${rawBody}`)>`. */
function sign(rawBody: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const h1 = createHmac("sha256", WEBHOOK_SECRET)
    .update(`${ts}:${rawBody}`)
    .digest("hex");
  return `ts=${ts};h1=${h1}`;
}

afterAll(async () => {
  if (pool) await pool.end();
});

describe("Paddle webhook → deployed grant-row live proof (seam 1, ADR-0224 F2=A)", () => {
  liveTest(
    "a signed delivery for the reserved proof account writes a real grant row, then tears it down",
    async () => {
      if (!db) return; // unreachable under liveTest, satisfies the null-narrowing
      const rawBody = proofPayload();

      // 1) Put the signed delivery through the DEPLOYED /webhook.
      const res = await fetchWithTimeout(
        WEBHOOK_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paddle-Signature": sign(rawBody),
          },
          body: rawBody,
        },
        { timeoutMs: 15_000 },
      );
      expect(res.status).toBe(200);

      try {
        // 2) Assert the grant durably landed for the reserved proof account (RLS-scoped read, the same
        //    isolation the production route uses). Every edition/module purchase grants an entitlement;
        //    credits depend on the price, so the entitlement row is the definitive grant proof.
        const grants = await withTenant(db, PROOF_ACCOUNT_ID, (tx) =>
          tx.query<{ n: string }>(
            `SELECT count(*)::text AS n FROM entitlement_grant
               WHERE account_id = $1 AND purchase_id = $2 AND status = 'active'`,
            [PROOF_ACCOUNT_ID, PAYMENT_ID],
          ),
        );
        expect(Number(grants.rows[0]?.n ?? "0")).toBeGreaterThan(0);

        // The credit ledger row (if the proof price grants credits) — a non-fatal companion signal.
        const credits = await withTenant(db, PROOF_ACCOUNT_ID, (tx) =>
          tx.query<{ n: string }>(
            `SELECT count(*)::text AS n FROM credit_event
               WHERE account_id = $1 AND source_event_id = $2 AND event_type = 'purchase'`,
            [PROOF_ACCOUNT_ID, PAYMENT_ID],
          ),
        );
        expect(Number(credits.rows[0]?.n ?? "0")).toBeGreaterThanOrEqual(0);
      } finally {
        // 3) Teardown — delete only THIS run's rows for the reserved account (best-effort; a cleanup
        //    failure must not fail the proof — the account is reserved and non-real either way).
        await withTenant(db, PROOF_ACCOUNT_ID, async (tx) => {
          await tx.query(
            `DELETE FROM entitlement_grant WHERE account_id = $1 AND purchase_id = $2`,
            [PROOF_ACCOUNT_ID, PAYMENT_ID],
          );
          await tx.query(
            `DELETE FROM credit_event WHERE account_id = $1 AND source_event_id = $2`,
            [PROOF_ACCOUNT_ID, PAYMENT_ID],
          );
        }).catch(() => {});
      }
    },
    TIMEOUT,
  );
});
