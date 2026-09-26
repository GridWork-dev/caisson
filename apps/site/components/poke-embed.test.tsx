import { renderIntoJsdom } from "@caisson-sh/testing";
import { describe, expect, test } from "bun:test";

import { MediaCarousel } from "./media-carousel";
import type { MediaSlide, PokeKey } from "@/lib/media-manifest";

// The one regression this file exists for: PokeEmbed must REMOUNT when the module changes.
//
// It owns iframe state — the load verdict, the measured height, and a ResizeObserver bound to a
// specific document's <body>. The card viewer keeps one dialog subtree mounted across entries
// (preview-dialog.tsx `heldVm`), so a poke slide rendered without a `key` gets its instance reused
// and only its `src` swapped: the observer stays attached to a destroyed document (the next poke
// never re-measures and is clipped by the frame's `overflow: hidden`), and a terminal
// `unavailable` from one module goes on naming a module nobody requested. None of that surfaces as
// an error — it just quietly shows the wrong thing on the marketplace surface.
//
// The assertion is DOM-node identity, because that is exactly what `key` controls: same element
// type at the same tree position means React keeps the host node and mutates it, and a changed key
// means React throws the node away and builds a new one.

const pokeSlides = (poke: PokeKey): readonly MediaSlide[] => [
  { kind: "poke", poke, caption: `${poke} interactive demo` },
];

describe("poke slides remount across modules (ADR-0400)", () => {
  test("a different module produces a different iframe element", () => {
    const r = renderIntoJsdom(
      <MediaCarousel slides={pokeSlides("credits")} label="credits media" />,
    );
    try {
      const first = r.document.querySelector("iframe");
      expect(first).not.toBeNull();
      expect(first!.getAttribute("src")).toBe("/demos/embed/credits");

      r.rerender(
        <MediaCarousel
          slides={pokeSlides("audit-worm")}
          label="audit-worm media"
        />,
      );

      const second = r.document.querySelector("iframe");
      expect(second).not.toBeNull();
      expect(second!.getAttribute("src")).toBe("/demos/embed/audit-worm");
      // Without the key this is the SAME node with a rewritten src — the whole defect.
      expect(second).not.toBe(first);
    } finally {
      r.unmount();
    }
  });

  // Guard the guard: if a rerender always replaced the node, the assertion above would pass for
  // the wrong reason and keep passing after someone removed the key.
  test("the same module keeps its iframe element across a rerender", () => {
    const r = renderIntoJsdom(
      <MediaCarousel slides={pokeSlides("credits")} label="credits media" />,
    );
    try {
      const first = r.document.querySelector("iframe");
      r.rerender(
        <MediaCarousel slides={pokeSlides("credits")} label="credits media" />,
      );
      expect(r.document.querySelector("iframe")).toBe(first);
    } finally {
      r.unmount();
    }
  });
});
