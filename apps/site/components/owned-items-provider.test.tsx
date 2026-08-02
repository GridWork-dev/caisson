import { renderIntoJsdom } from "@caisson/testing";
import { afterEach, describe, expect, mock, test } from "bun:test";

import { SESSION_HINT_COOKIE_NAME } from "@/lib/session-hint-cookie";
import { OwnedItemsProvider, useOwnedItems } from "./owned-items-provider";

// The owned-items fetch is gated on `SESSION_HINT_COOKIE_NAME` (CAISSON-81, ADR-0315) — the
// server-minted, non-HttpOnly hint cookie, NOT the real better-auth session cookie (which is
// HttpOnly and therefore invisible to `document.cookie` for every visitor, signed in or not — the
// exact bug a prior "skip when signed out" attempt shipped, silently disabling the double-pay
// guard for signed-in buyers too). These tests pin: the fetch fires only when the hint is present,
// a good response fills `owned`, a signed-out (no hint) render never calls fetch at all, and a
// hint-present-but-dead-session response degrades to empty rather than a false "owned".

function Probe({ cookie }: { cookie?: string }) {
  // Test-only render-phase side effect: seeds `document.cookie` BEFORE OwnedItemsProvider's mount
  // `useEffect` runs. React always finishes the whole tree's render phase (Probe included) before
  // ANY passive effect fires for that commit — including the provider's — so setting the cookie
  // here (rather than in a useEffect of its own, which would race the provider's) guarantees it's
  // visible by the time the provider's effect reads `document.cookie`. `renderIntoJsdom` mounts
  // synchronously inside one `act()` call with no earlier injection point, so this is the only
  // place in this test file where the cookie can be seeded pre-mount.
  if (cookie !== undefined) document.cookie = cookie;
  const owned = useOwnedItems();
  return <span data-testid="owned">{[...owned].join(",")}</span>;
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe("OwnedItemsProvider", () => {
  test("hint cookie present: fetches /api/cart/owned on mount and fills owned from the response (signed-in marking works even though the real session cookie is HttpOnly and never visible to document.cookie)", async () => {
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
        {/* Only the non-HttpOnly hint is ever readable via document.cookie in a real browser —
            the real `caisson.session_token` cookie never appears here even for a signed-in buyer,
            which is exactly what this test simulates by never setting it. */}
        <Probe cookie={`${SESSION_HINT_COOKIE_NAME}=1`} />
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

  test("no hint cookie (signed-out steady state): zero /api/cart/owned requests", async () => {
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
      expect(fetchSpy).toHaveBeenCalledTimes(0);
      expect(document.querySelector('[data-testid="owned"]')?.textContent).toBe(
        "",
      );
    } finally {
      unmount();
    }
  });

  test("fail-open: hint present but the session is actually dead — the fetch still runs and returns no owned ids, never a false 'owned'", async () => {
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
        <Probe cookie={`${SESSION_HINT_COOKIE_NAME}=1`} />
      </OwnedItemsProvider>,
    );
    try {
      await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
      // The hint alone can't tell a live session from a stale one — the fetch MUST still run.
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
        <Probe cookie={`${SESSION_HINT_COOKIE_NAME}=1`} />
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
