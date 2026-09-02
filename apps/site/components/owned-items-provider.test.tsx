import { renderIntoJsdom } from "@caisson/testing";
import { afterEach, describe, expect, mock, test } from "bun:test";

import { OwnedItemsProvider, useOwnedItems } from "./owned-items-provider";

// ADR-0418: the owned-items fetch fires unconditionally on mount now. A prior revision gated it
// on a client-readable hint cookie (`document.cookie`) so a signed-out visitor's render could skip
// the request entirely — that required the hint to be readable by page JS, a same-origin auth
// SIGNAL any script on the page (including a third-party one) could then observe. The ruling moved
// that optimization server-side instead: the hint cookie is now HttpOnly, and `GET /api/cart/owned`
// itself short-circuits on the cookie's absence before resolving a session — covered by
// `app/api/cart/owned/route.test.ts`, not here. These tests pin only the client's own contract: the
// fetch always fires, a good response fills `owned`, and a failure of any kind — a network error,
// or an empty response (no session, or one the route couldn't resolve) — degrades to empty, never
// a false "owned".

function Probe() {
  const owned = useOwnedItems();
  return <span data-testid="owned">{[...owned].join(",")}</span>;
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe("OwnedItemsProvider", () => {
  test("fetches /api/cart/owned on mount and fills owned from the response", async () => {
    const fetchSpy = mock((_input?: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ owned: ["module:audit-worm"] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { document, act, unmount } = renderIntoJsdom(
      <OwnedItemsProvider>
        <Probe />
      </OwnedItemsProvider>,
    );
    try {
      await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/cart/owned");
      expect(document.querySelector('[data-testid="owned"]')?.textContent).toBe(
        "module:audit-worm",
      );
    } finally {
      unmount();
    }
  });

  test("no hint cookie present: the fetch still fires (the client no longer gates on it), and an empty response leaves owned empty", async () => {
    const fetchSpy = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ owned: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { document, act, unmount } = renderIntoJsdom(
      <OwnedItemsProvider>
        <Probe />
      </OwnedItemsProvider>,
    );
    try {
      await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(document.querySelector('[data-testid="owned"]')?.textContent).toBe(
        "",
      );
    } finally {
      unmount();
    }
  });

  test("a failed fetch degrades to empty owned, not a crash", async () => {
    const fetchSpy = mock(() => Promise.reject(new Error("offline")));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { document, act, unmount } = renderIntoJsdom(
      <OwnedItemsProvider>
        <Probe />
      </OwnedItemsProvider>,
    );
    try {
      await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(document.querySelector('[data-testid="owned"]')?.textContent).toBe(
        "",
      );
    } finally {
      unmount();
    }
  });
});
