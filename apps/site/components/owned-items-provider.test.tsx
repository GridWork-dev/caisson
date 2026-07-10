import { renderIntoJsdom } from "@caisson/testing";
import { afterEach, describe, expect, mock, test } from "bun:test";

import {
  hasSessionCookie,
  OwnedItemsProvider,
  useOwnedItems,
} from "./owned-items-provider";

// Slice (b), ADR-0310: /api/cart/owned only fires when a better-auth session cookie is present.
// `hasSessionCookie` is the load-bearing invariant — tested directly (pure, deterministic)
// against the real cookie names better-auth mints, both bare and `__Secure-`-prefixed. The
// component-level test proves the WIRING: no cookie in the jar (the default, and every marketing
// page's steady state) means the effect never calls `fetch` at all — not "fetch and discard the
// result", an actual skipped call.

function Probe() {
  const owned = useOwnedItems();
  return <span data-testid="owned">{[...owned].join(",")}</span>;
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe("hasSessionCookie", () => {
  test("false when document.cookie carries no better-auth session cookie", () => {
    const { document, unmount } = renderIntoJsdom(<div />);
    try {
      document.cookie = "";
      document.cookie = "cs_theme=dark; path=/";
      expect(hasSessionCookie()).toBe(false);
    } finally {
      unmount();
    }
  });

  test("true for the bare cookie name", () => {
    const { document, unmount } = renderIntoJsdom(<div />);
    try {
      document.cookie = "caisson.session_token=abc; path=/";
      expect(hasSessionCookie()).toBe(true);
    } finally {
      unmount();
    }
  });

  test("true for the __Secure- prefixed cookie name (production)", () => {
    const { document, unmount } = renderIntoJsdom(<div />);
    try {
      // The `__Secure-` prefix is a browser-enforced cookie rule (RFC 6265bis, jsdom included):
      // a prefixed cookie is silently dropped unless it also carries the `secure` attribute.
      document.cookie = "__Secure-caisson.session_token=abc; path=/; secure";
      expect(hasSessionCookie()).toBe(true);
    } finally {
      unmount();
    }
  });
});

describe("OwnedItemsProvider — session-cookie gate (ADR-0310 slice b)", () => {
  test("no session cookie present: /api/cart/owned is never called", async () => {
    const fetchSpy = mock(() => Promise.reject(new Error("should not fetch")));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { document, act, unmount } = renderIntoJsdom(
      <OwnedItemsProvider>
        <Probe />
      </OwnedItemsProvider>,
    );
    try {
      // A fresh renderIntoJsdom window starts with an empty cookie jar — the signed-out steady
      // state — and the effect has already run synchronously by the time we get here.
      document.cookie = "";
      await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(document.querySelector('[data-testid="owned"]')?.textContent).toBe(
        "",
      );
    } finally {
      unmount();
    }
  });
});
