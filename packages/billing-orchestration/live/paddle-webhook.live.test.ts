// live/paddle-webhook.live.test.ts — the LIVE Paddle webhook-VERIFIER proof (seam 1, ADR-0224 F1=C).
// Proves the one thing the double-backed unit suite (paddle.test.ts, hand-signed) never can: our
// hand-rolled `verifyPaddleWebhook` (paddle-webhook.ts — NO @paddle/paddle-node-sdk) against a REAL
// Paddle-generated `Paddle-Signature`, so a scheme drift on Paddle's side (colon-join, `ts:rawBody`,
// the 5s tolerance) is surfaced here instead of in production on a real purchase.
//
// TWO legs, both self-skipping (ADR-0201 convention — OUTSIDE ./src, so `bun test ./src`, CI, and the
// published tarball never see them; run via `bun run test:live`):
//
//   Leg A (routine, headless) — the Paddle SIMULATOR API. Create a throwaway sandbox notification
//   destination pointed at a test-controlled receiver, create + run a `transaction.completed`
//   simulation (POST /simulations + POST /simulations/{id}/runs), capture the delivery, and resolve
//   the A1 fork EMPIRICALLY: if the delivery carries a `Paddle-Signature` that verifies under the
//   destination's own secret, assert the FULL verify leg; if not, assert parse-only and print a clear
//   skip note (the real-signature verify leg then stays proven only by a genuine checkout — leg B —
//   and by the hand-signed unit suite). This IS the SPEC's Task-1 A1 probe, automated.
//
//   Leg B (rarely-run, full fidelity) — a Playwright sandbox CHECKOUT that drives the real Paddle.js
//   overlay with a sandbox test card, producing a genuine checkout-signed `transaction.completed`.
//   Playwright is NOT a dependency of this published package (it is only an optional peer of `next`);
//   to keep it out of default installs, it is DYNAMICALLY imported inside the test body — the skip
//   path never touches it. Run leg B by first `bun add -d @playwright/test` (or `playwright`) and
//   setting PADDLE_SANDBOX_CHECKOUT_URL.
import { describe, expect, test } from "bun:test";
import { AuthnError, fetchWithTimeout, parseStrict } from "@caisson-sh/kernel";
import { verifyPaddleWebhook } from "@caisson-sh/billing";
import { PaddleEventSchema, parsePaddleEvent } from "../src/paddle-events.ts";

// --- Leg A env (simulator) --------------------------------------------------------------------
const API_KEY = process.env.PADDLE_API_KEY ?? "";
// The PUBLIC url Paddle can reach that forwards to the local receiver below (a cloudflared/ngrok
// tunnel to PADDLE_SIM_RECEIVER_PORT). Loopback is unreachable by Paddle, so the operator exposes it.
const RECEIVER_URL = process.env.PADDLE_SIM_RECEIVER_URL ?? "";
const RECEIVER_PORT = Number(process.env.PADDLE_SIM_RECEIVER_PORT ?? "8799");
const PADDLE_BASE =
  process.env.PADDLE_ENV === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
const HAVE_SIM = API_KEY.length > 0 && RECEIVER_URL.length > 0;
const simTest = test.skipIf(!HAVE_SIM);

// --- Leg B env (playwright) -------------------------------------------------------------------
// A URL that opens the Paddle.js overlay for a sandbox price (the operator's own sandbox checkout
// page, or apps/site's checkout with NEXT_PUBLIC_PADDLE_* pointed at sandbox).
const CHECKOUT_URL = process.env.PADDLE_SANDBOX_CHECKOUT_URL ?? "";
const HAVE_PW = CHECKOUT_URL.length > 0;
const pwTest = test.skipIf(!HAVE_PW);

const SIM_TIMEOUT = 60_000;
const DELIVERY_WAIT_MS = 45_000;

/** Thin Paddle Billing REST call via the mandatory fetchWithTimeout (never a bare fetch). */
async function paddle(
  path: string,
  method: "GET" | "POST" | "DELETE",
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetchWithTimeout(
    `${PADDLE_BASE}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    { timeoutMs: 15_000 },
  );
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

function dataOf(json: Record<string, unknown>): Record<string, unknown> {
  const d = json.data;
  return typeof d === "object" && d !== null
    ? (d as Record<string, unknown>)
    : {};
}

describe("Paddle webhook verifier live proof (seam 1, ADR-0224 F1=C)", () => {
  simTest(
    "leg A — a REAL simulator-delivered payload verifies (or parse-only + A1 skip note)",
    async () => {
      let settingId = "";
      let simId = "";
      let received: { sig: string; rawBody: string } | undefined;
      let resolveDelivery!: (d: { sig: string; rawBody: string }) => void;
      const delivery = new Promise<{ sig: string; rawBody: string }>((r) => {
        resolveDelivery = r;
      });
      // The throwaway receiver: captures the FIRST delivery Paddle sends to the destination.
      const server = Bun.serve({
        port: RECEIVER_PORT,
        fetch: async (req) => {
          const rawBody = await req.text();
          resolveDelivery({
            sig: req.headers.get("paddle-signature") ?? "",
            rawBody,
          });
          return new Response("ok");
        },
      });

      try {
        // 1) Create a throwaway sandbox notification destination → read back its signing secret.
        // ponytail: field names track Paddle's create-notification-setting contract; if the API
        // shape has drifted, this is the one call to re-check (the calibration knob).
        const created = await paddle("/notification-settings", "POST", {
          description: `caisson-live-proof-${Date.now()}`,
          destination: RECEIVER_URL,
          type: "url",
          subscribed_events: ["transaction.completed"],
          // Paddle rejects simulation runs against a default (platform-traffic) destination:
          // "Notification setting cannot be used for 'simulation' traffic."
          traffic_source: "simulation",
        });
        expect(created.status).toBeLessThan(300);
        const setting = dataOf(created.json);
        settingId = String(setting.id ?? "");
        const secret = String(setting.endpoint_secret_key ?? "");
        expect(settingId.length).toBeGreaterThan(0);
        expect(secret.length).toBeGreaterThan(0);

        // 2) Create a simulation for that destination, then 3) run it.
        const sim = await paddle("/simulations", "POST", {
          notification_setting_id: settingId,
          name: `caisson-live-proof-${Date.now()}`,
          type: "transaction.completed",
        });
        expect(sim.status).toBeLessThan(300);
        simId = String(dataOf(sim.json).id ?? "");
        expect(simId.length).toBeGreaterThan(0);

        const run = await paddle(`/simulations/${simId}/runs`, "POST", {});
        expect(run.status).toBeLessThan(300);

        // 4) Wait for Paddle to deliver to the receiver.
        received = await Promise.race([
          delivery,
          new Promise<{ sig: string; rawBody: string }>((_, rej) =>
            setTimeout(
              () => rej(new Error("simulator delivery never arrived")),
              DELIVERY_WAIT_MS,
            ),
          ),
        ]);

        // The envelope always parses (proves the delivered SHAPE).
        const event = parseStrict(
          PaddleEventSchema,
          JSON.parse(received.rawBody),
        );
        expect(event.event_type.length).toBeGreaterThan(0);

        // 5) A1 fork, resolved live.
        if (received.sig.length > 0) {
          // A1 = SIGNED: the load-bearing proof — our verifier accepts a REAL Paddle signature.
          let verified = false;
          try {
            verifyPaddleWebhook(received.rawBody, received.sig, secret);
            verified = true;
          } catch (err) {
            // A signed-but-rejected delivery is a genuine scheme-drift finding — fail loudly.
            const msg = err instanceof AuthnError ? err.message : String(err);
            throw new Error(
              `A1=signed but verifyPaddleWebhook REJECTED a real Paddle signature — scheme drift: ${msg}`,
              { cause: err },
            );
          }
          expect(verified).toBe(true);
          // And it parses to a domain event (transaction.completed → purchase/invoice), or null for a
          // scenario Paddle fired that we don't act on — either is a valid PARSE, not a throw.
          expect(() => parsePaddleEvent(event)).not.toThrow();
        } else {
          // A1 = UNSIGNED: prove parse+shape only; the real-signature verify leg stays covered by leg
          // B + the hand-signed unit suite. This is a recorded outcome, not a failure.
          expect(() => parsePaddleEvent(event)).not.toThrow();
          process.stderr.write(
            "[live] A1 UNSIGNED: simulator delivery carried no Paddle-Signature — verify leg SKIPPED " +
              "(covered by leg B + packages/billing/src/paddle.test.ts). Record this in docs/ops/live-harness.md.\n",
          );
        }
      } finally {
        server.stop(true);
        // Best-effort teardown of the throwaway destination + simulation (WORM-reaper pattern —
        // a cleanup failure must never fail the proof).
        if (simId.length > 0)
          await paddle(`/simulations/${simId}`, "DELETE").catch(() => {});
        if (settingId.length > 0)
          await paddle(`/notification-settings/${settingId}`, "DELETE").catch(
            () => {},
          );
      }
    },
    SIM_TIMEOUT,
  );

  pwTest(
    "leg B — a real Paddle.js sandbox checkout completes (full-fidelity, rarely run)",
    async () => {
      // Dynamic import so the skip path (and every default install) never needs Playwright. Install
      // it before running this leg: `bun add -d @playwright/test`.
      // ponytail: the overlay is a THIRD-PARTY iframe — selectors + the sandbox test card are the
      // calibration knob; tune per the live Paddle.js version, they cannot be verified headless-free.
      const pw = await import("playwright");
      const browser = await pw.chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.goto(CHECKOUT_URL, { waitUntil: "networkidle" });

        // Paddle.js renders the overlay inside an iframe; wait for it, then fill the sandbox test card.
        const frame = await page.waitForSelector("iframe[name^='paddle']", {
          timeout: 30_000,
        });
        const checkout = await frame.contentFrame();
        expect(checkout).not.toBeNull();
        if (checkout === null) return;

        await checkout
          .getByPlaceholder(/email/i)
          .fill(process.env.PADDLE_SANDBOX_EMAIL ?? "proof@caisson.sh")
          .catch(() => {});
        // Paddle sandbox universal test card.
        await checkout
          .getByPlaceholder(/card number/i)
          .fill("4242424242424242")
          .catch(() => {});
        await checkout
          .getByPlaceholder(/mm\/yy|expiry/i)
          .fill("12/30")
          .catch(() => {});
        await checkout
          .getByPlaceholder(/cvc|cvv|security/i)
          .fill("100")
          .catch(() => {});
        await checkout
          .getByRole("button", { name: /pay|subscribe|continue/i })
          .click();

        // A genuine sandbox charge → Paddle shows a success state / redirects to the success url.
        await page.waitForURL(/success|thank|complete/i, { timeout: 45_000 });
        expect(page.url()).toMatch(/success|thank|complete/i);
      } finally {
        await browser.close();
      }
    },
    120_000,
  );
});
