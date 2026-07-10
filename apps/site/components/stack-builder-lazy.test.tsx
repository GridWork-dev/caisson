import { renderIntoJsdom } from "@caisson/testing";
import { describe, expect, test } from "bun:test";

import { MODULE_PRICES, PERSONA_BUNDLE_IDS } from "@/lib/pricing";

import { StackBuilderLazy } from "./stack-builder-lazy";

// A2 (ADR-0310): StackBuilder no longer hydrates at t0 — it defer-mounts on idle behind a static
// poster. The load-bearing invariants covered here: (1) the poster's picker groups don't drift
// from the real catalog (they're a hand-duplicated copy of stack-builder.tsx's grouping, since
// that file is out of this task's scope), and (2) the FIRST paint is the inert poster, not the
// real interactive component — proving the mount really is deferred, not immediate.
//
// NOT covered: asserting the swap TO the real component actually happens post-idle. next/dynamic's
// `ssr:false` path (`noSSR()` in next's `dynamic.js`) branches on `typeof window === 'undefined'`
// evaluated ONCE at next/dynamic's own module-import time — under `bun test` that's before any
// test has called `renderIntoJsdom` to put a `window` on `globalThis`, so it freezes into an
// always-render-the-poster stub for the rest of the process. A real browser hits the
// `window`-present branch and resolves normally; this is a test-harness gap, not a product bug.
describe("StackBuilderLazy — deferred mount + poster parity (ADR-0310 A2)", () => {
  test("mounts synchronously as the poster: one checkbox per catalog module, all disabled", () => {
    const { document, unmount } = renderIntoJsdom(<StackBuilderLazy />);
    try {
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      // Every module in the catalog appears exactly once across the poster's groups — the same
      // partition stack-builder.tsx's real PICKER_GROUPS makes (persona bundles[0] + platform).
      expect(checkboxes.length).toBe(MODULE_PRICES.length);
      for (const cb of Array.from(checkboxes)) {
        expect(cb.hasAttribute("disabled")).toBe(true);
      }

      // One <fieldset> per non-empty persona group, plus Platform if it has members.
      const groupCount =
        PERSONA_BUNDLE_IDS.filter((b) =>
          MODULE_PRICES.some((m) => m.bundles[0] === b),
        ).length + (MODULE_PRICES.some((m) => m.bundles.length === 0) ? 1 : 0);
      expect(document.querySelectorAll("fieldset").length).toBe(groupCount);

      // The empty-rail resting copy renders — no "N selected" total, no mobile bar.
      expect(document.body.textContent).toContain("No modules selected yet");
    } finally {
      unmount();
    }
  });
});
