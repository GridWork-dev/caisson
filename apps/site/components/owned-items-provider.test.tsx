import { renderIntoJsdom } from "@caisson/testing";
import { afterEach, describe, expect, mock, test } from "bun:test";

import { OwnedItemsProvider, useOwnedItems } from "./owned-items-provider";

// The owned-items fetch is UNCONDITIONAL on mount (the session cookie is HttpOnly, so no
// client-side signed-in check is possible) — the owned-items disable it feeds is the only guard
// against a signed-in owner re-paying for something they already own. These tests pin that: the
// fetch fires on mount, a good response fills `owned`, and a failure degrades to empty (stale Buy
// button) rather than throwing.

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
    const fetchSpy = mock(() =>
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
