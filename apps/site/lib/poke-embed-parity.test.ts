// The contract between apps/site and apps/demos (ADR-0400), which is exactly one thing: an id.
//
// The site emits `<iframe src="/demos/embed/${slide.poke}">` for every `kind: "poke"` slide in its
// media manifest; apps/demos pre-renders one route per entry in POKE_IDS. Nothing else couples the
// two apps — no shared package, no import, no build order. So the ONE way this split breaks
// silently is a spelling that exists on one side and not the other: a poke the manifest renders
// with no route to answer it (the module page shows the fallback text in production, and no gate
// notices), or a route nobody asks for (dead pages, and a poke that quietly stopped shipping).
//
// This test reads both sides as real data — the manifest through its public `mediaSlides` API,
// the routes through the list the embed route's `generateStaticParams` is built from — rather than
// restating either list here, which would just be a third copy to drift.
//
// The `../../demos/...` import below is the ONE place anything in apps/site reaches into apps/demos,
// and it is deliberate: a parity test that imported a local copy of the id list would pass while
// production was broken. It is a test-only edge — no product code crosses it — so a future "apps
// must not reference each other" sweep should leave this line alone rather than 'fix' it.
import { describe, expect, test } from "bun:test";

import { POKE_IDS } from "../../demos/components/poke/ids";
import { mediaSlides } from "./media-manifest";
import { BUNDLES, MODULES } from "./catalog";

/** Every poke id the site actually renders, across both entry kinds. */
function manifestPokeIds(): string[] {
  const ids = new Set<string>();
  for (const module of MODULES) {
    for (const slide of mediaSlides("module", module.id)) {
      if (slide.kind === "poke" && slide.poke) ids.add(slide.poke);
    }
  }
  for (const bundle of BUNDLES) {
    for (const slide of mediaSlides("bundle", bundle.id)) {
      if (slide.kind === "poke" && slide.poke) ids.add(slide.poke);
    }
  }
  return [...ids].sort();
}

describe("every poke the site renders has an embed route in apps/demos", () => {
  const manifest = manifestPokeIds();

  test("the manifest really yields pokes (guard the guard)", () => {
    // Without this, a manifest change that stopped emitting poke slides would make both
    // assertions below compare two empty sets and pass while every demo silently disappeared.
    expect(manifest.length).toBeGreaterThan(20);
  });

  test("the id sets are identical in both directions", () => {
    expect(manifest).toEqual([...POKE_IDS].sort());
  });

  test("bundles borrow a member's poke rather than introducing an id of their own", () => {
    // ADR-0378 lock 1 (borrow, never fork) restated as a boundary check: a bundle that invented
    // its own poke id would need a route apps/demos has no component for.
    for (const bundle of BUNDLES) {
      for (const slide of mediaSlides("bundle", bundle.id)) {
        if (slide.kind === "poke" && slide.poke) {
          expect(POKE_IDS).toContain(slide.poke);
        }
      }
    }
  });
});
