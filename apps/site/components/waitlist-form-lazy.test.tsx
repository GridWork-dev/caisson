import { renderIntoJsdom } from "@caisson/testing";
import { describe, expect, test } from "bun:test";

import { UpdatesFormLazy } from "./waitlist-form-lazy";

// A4b (ADR-0310): the footer's product-updates form defer-mounts behind a static poster — the
// real <UpdatesForm> (Turnstile script, multi-field state) never ships in the initial bundle.
// The load-bearing invariant covered here: the FIRST paint is the inert poster (proving the
// mount is really deferred, not immediate), with the same field set as the real form's idle
// state, so swapping in the hydrated component is a no-op layout-wise (no CLS).
//
// NOT covered: asserting the swap TO the real component actually happens. `next/dynamic`'s
// `ssr:false` path (`noSSR()` in next's `dynamic.js`) branches on `typeof window === 'undefined'`
// evaluated ONCE at next/dynamic's own module-import time — which, under `bun test`, is before
// any test has called `renderIntoJsdom` to put a `window` on `globalThis`. That freezes the
// no-SSR branch into an always-render-the-poster stub for the rest of the process, so this
// harness structurally cannot observe the resolved state (a real browser hits the `window`-
// present branch and resolves normally — this is a test-environment gap, not a production bug).
describe("UpdatesFormLazy — deferred mount + poster parity (ADR-0310 A4b)", () => {
  test("mounts synchronously as the disabled poster: email input, consent row, submit button", () => {
    const { document, unmount } = renderIntoJsdom(
      <UpdatesFormLazy source="footer" />,
    );
    try {
      const email = document.querySelector('input[type="email"]');
      expect(email).not.toBeNull();
      expect(email!.hasAttribute("disabled")).toBe(true);

      const checkbox = document.querySelector('input[type="checkbox"]');
      expect(checkbox).not.toBeNull();
      expect(checkbox!.hasAttribute("disabled")).toBe(true);

      const button = document.querySelector("button");
      expect(button).not.toBeNull();
      expect(button!.hasAttribute("disabled")).toBe(true);
      expect(document.body.textContent).toContain("Get product updates");
    } finally {
      unmount();
    }
  });
});
