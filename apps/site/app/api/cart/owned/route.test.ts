// Regression coverage for ADR-0418: GET /api/cart/owned short-circuits on the hint cookie's
// ABSENCE before ever calling getOwnedCartItemIds() — the server-side half of the optimization a
// prior revision did client-side (skipping the fetch itself via a client-readable hint cookie).
// This route takes no params and has no dependency-injection seam (unlike
// `app/api/audit/proof/route.ts`'s `createTenantProofRoute(dependencies)` factory), so — per the
// existing `mock.module("next/headers", ...)` idiom already used by `lib/auth.test.ts` and
// `lib/auth-account.test.ts` for the same reason (this runs outside a real Next request scope) —
// `cookies()` is stubbed here rather than inventing a new mocking layer. `@/lib/owned-cart-items`
// is stubbed too, purely to observe whether it was ever called; the cookie's PRESENCE case below
// proves it still IS called — the hint is a fail-open optimization, never a trust boundary.
import { expect, mock, test } from "bun:test";
import { SESSION_HINT_COOKIE_NAME } from "@/lib/session-hint-cookie";

let hintCookiePresent = false;
let getOwnedCartItemIdsCalls = 0;

mock.module("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === SESSION_HINT_COOKIE_NAME && hintCookiePresent
        ? { name, value: "1" }
        : undefined,
  }),
}));

mock.module("@/lib/owned-cart-items", () => ({
  getOwnedCartItemIds: async (): Promise<Set<string>> => {
    getOwnedCartItemIdsCalls++;
    return new Set(["module:audit-worm"]);
  },
}));

test("no hint cookie: returns {owned: []} without ever calling getOwnedCartItemIds", async () => {
  hintCookiePresent = false;
  getOwnedCartItemIdsCalls = 0;
  const { GET } = await import("./route.ts");

  const response = await GET();

  expect(await response.json()).toEqual({ owned: [] });
  expect(getOwnedCartItemIdsCalls).toBe(0);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});

test("hint cookie present: falls through to the real session resolution (a hint is a fail-open optimization, not a grant)", async () => {
  hintCookiePresent = true;
  getOwnedCartItemIdsCalls = 0;
  const { GET } = await import("./route.ts");

  const response = await GET();

  expect(await response.json()).toEqual({ owned: ["module:audit-worm"] });
  expect(getOwnedCartItemIdsCalls).toBe(1);
});
