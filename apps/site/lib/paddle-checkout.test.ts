// G6 (init-failure poisons checkout for the session) + G35 (cart cleared on overlay-open, not on
// payment) over `lib/paddle-checkout.ts`. `@paddle/paddle-js` is mocked so `initializePaddle`'s
// resolve/reject is fully controlled and its `eventCallback` is captured for direct invocation —
// the real Paddle.js runs in the browser only. Sequential by design: `paddle-checkout.ts` is a
// module-level singleton (memoized `paddleInstance`/`paddleInitPromise`), so this file's two
// describe blocks run as one continuous scenario (init failure → retry → success → completed
// event), not independent cases.
import { describe, expect, mock, test } from "bun:test";

let initCalls = 0;
let shouldReject = false;
let capturedEventCallback: ((event: { name?: string }) => void) | undefined;

const fakeCheckoutOpen = mock((_opts: Record<string, unknown>) => undefined);

mock.module("@paddle/paddle-js", () => ({
  CheckoutEventNames: { CHECKOUT_COMPLETED: "checkout.completed" },
  initializePaddle: (opts: {
    eventCallback?: (event: { name?: string }) => void;
  }) => {
    initCalls += 1;
    capturedEventCallback = opts.eventCallback;
    if (shouldReject) return Promise.reject(new Error("paddle init failed"));
    return Promise.resolve({
      Checkout: {
        open: fakeCheckoutOpen,
        updateCheckout: mock(() => undefined),
        updateItems: mock(() => undefined),
        close: mock(() => undefined),
      },
    });
  },
}));

process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = "test_token";

describe("G6 — an init failure does not poison checkout for the rest of the session", () => {
  test("a rejected initializePaddle() propagates, and the NEXT call retries fresh", async () => {
    const { openCheckout } = await import("./paddle-checkout.ts");

    shouldReject = true;
    await expect(
      openCheckout({ priceId: "pri_x", accountId: "acct_1" }),
    ).rejects.toThrow("paddle init failed");
    expect(initCalls).toBe(1);

    // Before the G6 fix, `paddleInitPromise` stayed memoized as the same rejected promise forever
    // — a second call would reuse it (and reject again) instead of trying again.
    shouldReject = false;
    const opened = await openCheckout({
      priceId: "pri_x",
      accountId: "acct_1",
    });
    expect(opened).toBe(true);
    expect(initCalls).toBe(2); // proves initializePaddle() ran again, not a cached dead promise
  });
});

describe("abandoned-checkout discount fork (SPEC-abandoned-checkout-email.md, 2026-07-10 lock)", () => {
  test("a discount code is threaded into Checkout.open's discountCode option", async () => {
    const { openCartCheckout } = await import("./paddle-checkout.ts");
    fakeCheckoutOpen.mockClear();

    await openCartCheckout([{ priceId: "pri_x" }], "acct_1", "SAVE10");

    expect(fakeCheckoutOpen).toHaveBeenCalledTimes(1);
    const openArgs = fakeCheckoutOpen.mock.calls[0]?.[0] as
      | { discountCode?: string }
      | undefined;
    expect(openArgs?.discountCode).toBe("SAVE10");
  });

  test("an omitted discount code is never passed as an explicit key", async () => {
    const { openCartCheckout } = await import("./paddle-checkout.ts");
    fakeCheckoutOpen.mockClear();

    await openCartCheckout([{ priceId: "pri_x" }], "acct_1");

    const openArgs = fakeCheckoutOpen.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(openArgs).toBeDefined();
    expect("discountCode" in (openArgs ?? {})).toBe(false);
  });
});

describe("G35 — the cart clears on checkout.completed, not on overlay-open", () => {
  test("onCheckoutCompleted fires only for the checkout.completed event, until unregistered", async () => {
    const { onCheckoutCompleted } = await import("./paddle-checkout.ts");
    expect(capturedEventCallback).toBeDefined();

    let fired = 0;
    const unregister = onCheckoutCompleted(() => {
      fired += 1;
    });

    // A different event (e.g. the overlay merely loading) must NOT fire the listener — the exact
    // behavior G35 fixes (the old code cleared on open, not on completion).
    capturedEventCallback?.({ name: "checkout.loaded" });
    expect(fired).toBe(0);

    capturedEventCallback?.({ name: "checkout.completed" });
    expect(fired).toBe(1);

    unregister();
    capturedEventCallback?.({ name: "checkout.completed" });
    expect(fired).toBe(1); // unregistered — no further calls
  });
});

test("server cart opens only the validated transaction id, without overriding lines or account", async () => {
  const { openCartTransaction } = await import("./paddle-checkout.ts");
  fakeCheckoutOpen.mockClear();
  const transactionId = `txn_${"a".repeat(26)}`;
  expect(await openCartTransaction(transactionId)).toBe(true);
  expect(fakeCheckoutOpen.mock.calls[0]?.[0]).toEqual({
    transactionId,
    settings: { showAddTaxId: true },
  });
  expect(await openCartTransaction("forged")).toBe(false);
  expect(fakeCheckoutOpen).toHaveBeenCalledTimes(1);
});
