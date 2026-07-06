// Unit coverage for the SKU-attribution stamping on the server-side PostHog `purchase` capture:
// price ids / canonical product slugs land verbatim, and cart composition classifies
// bundle-only, modules-only, mixed (edition + module), and lineless carts correctly. The
// never-throws / config-gate contract is covered end to end by webhook-app.integration.test.ts;
// this file is the unit check for the classification branch (ponytail: one runnable check per
// non-trivial branch). Slugs are the CANONICAL catalog ids the mapper normalizes to — a bundle id
// from BUNDLE_IDS (`compliance`, `everything`), a `<slug>_module`, or a bare tag (`credit_pack`).
import { describe, expect, test } from "bun:test";
import type { fetchWithTimeout } from "@caisson/kernel";
import {
  capturePostHogPurchase,
  type PurchaseCapture,
} from "./posthog-capture.ts";

const CONFIG = { key: "phc_test", host: "https://ingest.test" };

type FetchImpl = typeof fetchWithTimeout;

function recordingFetch(calls: Array<Record<string, unknown>>): FetchImpl {
  return async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      properties: Record<string, unknown>;
    };
    calls.push(body.properties);
    return new Response(null, { status: 200 });
  };
}

function capture(skuLines: PurchaseCapture["skuLines"]): PurchaseCapture {
  return {
    accountId: "acct_1",
    entitlements: ["compliance"],
    amountTotalMinor: 74900,
    currency: "usd",
    sourceEventId: "evt_1",
    skuLines,
  };
}

describe("capturePostHogPurchase — SKU attribution", () => {
  test("stamps price ids + canonical product slugs verbatim, in line order", async () => {
    const calls: Array<Record<string, unknown>> = [];
    await capturePostHogPurchase(
      CONFIG,
      capture([{ priceId: "pri_everything", productSlug: "everything" }]),
      recordingFetch(calls),
    );
    expect(calls[0]?.price_ids).toEqual(["pri_everything"]);
    expect(calls[0]?.product_slugs).toEqual(["everything"]);
  });

  test("a single canonical bundle id classifies as bundle", async () => {
    const calls: Array<Record<string, unknown>> = [];
    await capturePostHogPurchase(
      CONFIG,
      capture([{ priceId: "pri_compliance", productSlug: "compliance" }]),
      recordingFetch(calls),
    );
    expect(calls[0]?.cart_composition).toBe("bundle");
  });

  test("two à-la-carte module lines classify as modules", async () => {
    const calls: Array<Record<string, unknown>> = [];
    await capturePostHogPurchase(
      CONFIG,
      capture([
        { priceId: "pri_a", productSlug: "field-crypto_module" },
        { priceId: "pri_b", productSlug: "audit-worm_module" },
      ]),
      recordingFetch(calls),
    );
    expect(calls[0]?.cart_composition).toBe("modules");
  });

  test("a bundle line plus a module line classifies as mixed", async () => {
    const calls: Array<Record<string, unknown>> = [];
    await capturePostHogPurchase(
      CONFIG,
      capture([
        { priceId: "pri_edition", productSlug: "ai-production" },
        { priceId: "pri_module", productSlug: "field-crypto_module" },
      ]),
      recordingFetch(calls),
    );
    expect(calls[0]?.cart_composition).toBe("mixed");
  });

  test("a lineless grant (a subscription cycle carrying no lines) omits cart_composition", async () => {
    const calls: Array<Record<string, unknown>> = [];
    await capturePostHogPurchase(CONFIG, capture([]), recordingFetch(calls));
    expect(calls[0]?.price_ids).toEqual([]);
    expect("cart_composition" in (calls[0] ?? {})).toBe(false);
  });
});
