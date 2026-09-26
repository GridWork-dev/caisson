import { renderIntoJsdom } from "@caisson-sh/testing";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Reveal } from "./reveal";

// A4a (ADR-0310): 13 per-instance IntersectionObservers collapsed to one module-level observer +
// a WeakMap. The load-bearing invariants are (1) N instances share ONE observer construction —
// for the LIFE OF THE MODULE, not per-render, (2) each instance reveals off ITS OWN intersection
// only (the WeakMap fan-out can't cross wires between siblings), and (3) SSR never touches the
// `IntersectionObserver` constructor.
//
// Because the shared observer is a true module-level singleton, `FakeIntersectionObserver
// .instances` should stay at length 1 across EVERY test below (not reset between tests) — that
// persistence is itself the behavior under test, mirroring one real page's lifetime.

/** Minimal IntersectionObserver stand-in — jsdom ships none. `instances` lets a test grab the one
 * constructed observer and drive it exactly like a real browser delivering an entry. */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  observed = new Set<Element>();

  constructor(callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
    this.callback = callback;
  }
  observe(el: Element) {
    this.observed.add(el);
  }
  unobserve(el: Element) {
    this.observed.delete(el);
  }
  disconnect() {
    this.observed.clear();
  }
  takeRecords() {
    return [];
  }
  fire(el: Element, isIntersecting: boolean) {
    this.callback(
      [{ target: el, isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

(
  globalThis as unknown as { IntersectionObserver: unknown }
).IntersectionObserver = FakeIntersectionObserver;

describe("Reveal — shared observer (ADR-0310 A4a)", () => {
  test("two instances share ONE observer construction; each reveals off its own intersection only", () => {
    const { document, act, unmount } = renderIntoJsdom(
      <>
        <Reveal className="one">
          <p>a</p>
        </Reveal>
        <Reveal className="two">
          <p>b</p>
        </Reveal>
      </>,
    );
    try {
      // Sharing: two <Reveal> instances, one constructor call.
      expect(FakeIntersectionObserver.instances.length).toBe(1);
      const shared = FakeIntersectionObserver.instances[0]!;

      const elA = document.querySelector(".one")!;
      const elB = document.querySelector(".two")!;
      expect(shared.observed.has(elA)).toBe(true);
      expect(shared.observed.has(elB)).toBe(true);
      expect(elA.className).not.toContain("is-visible");
      expect(elB.className).not.toContain("is-visible");

      // Fan-out correctness: firing intersection for elA alone must reveal ONLY elA.
      act(() => shared.fire(elA, true));

      expect(elA.className).toContain("is-visible");
      expect(elB.className).not.toContain("is-visible");
      // Reveal-once: the fired element is unobserved; the untouched sibling still is.
      expect(shared.observed.has(elA)).toBe(false);
      expect(shared.observed.has(elB)).toBe(true);
    } finally {
      unmount();
    }
  });

  test("the same singleton observer serves a later, unrelated mount — and unmounting unobserves it", () => {
    const { document, unmount } = renderIntoJsdom(
      <Reveal className="target">
        <p>content</p>
      </Reveal>,
    );
    // Still exactly one construction, ever — proves the observer isn't rebuilt per mount.
    expect(FakeIntersectionObserver.instances.length).toBe(1);
    const shared = FakeIntersectionObserver.instances[0]!;

    const el = document.querySelector(".target")!;
    expect(shared.observed.has(el)).toBe(true);

    unmount();

    expect(shared.observed.has(el)).toBe(false);
  });
});

describe("Reveal — SSR-safety (ADR-0310 A4a)", () => {
  test("renderToStaticMarkup succeeds with no global IntersectionObserver defined — the shared observer is never constructed at module eval", () => {
    const saved = (globalThis as unknown as { IntersectionObserver?: unknown })
      .IntersectionObserver;
    delete (globalThis as unknown as { IntersectionObserver?: unknown })
      .IntersectionObserver;
    try {
      const html = renderToStaticMarkup(
        <Reveal>
          <p>server-rendered</p>
        </Reveal>,
      );
      expect(html).toContain("cs-reveal");
      expect(html).not.toContain("is-visible");
      expect(html).toContain("server-rendered");
    } finally {
      (
        globalThis as unknown as { IntersectionObserver?: unknown }
      ).IntersectionObserver = saved;
    }
  });
});
