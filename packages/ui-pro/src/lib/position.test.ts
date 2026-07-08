import { describe, expect, test } from "bun:test";

import { computeFloatingPosition } from "./position";

const VIEWPORT = { width: 1024, height: 768 };
const PANEL = { width: 200, height: 100 };

describe("computeFloatingPosition", () => {
  test("places below the trigger by default when it fits", () => {
    const trigger = { top: 100, left: 100, width: 40, height: 20 };
    const pos = computeFloatingPosition(trigger, PANEL, VIEWPORT);
    expect(pos.placement).toBe("bottom");
    expect(pos.top).toBe(100 + 20 + 8);
    expect(pos.left).toBe(100);
  });

  test("flips to top when bottom would overflow the viewport", () => {
    const trigger = { top: 700, left: 100, width: 40, height: 20 };
    const pos = computeFloatingPosition(trigger, PANEL, VIEWPORT, "bottom");
    expect(pos.placement).toBe("top");
    expect(pos.top).toBe(700 - 100 - 8);
  });

  test("clamps the cross axis so the panel never overflows the right edge", () => {
    const trigger = { top: 100, left: 980, width: 20, height: 20 };
    const pos = computeFloatingPosition(trigger, PANEL, VIEWPORT);
    expect(pos.left + PANEL.width).toBeLessThanOrEqual(VIEWPORT.width);
  });

  test("clamps the cross axis so the panel never overflows the left edge", () => {
    const trigger = { top: 100, left: -50, width: 20, height: 20 };
    const pos = computeFloatingPosition(trigger, PANEL, VIEWPORT);
    expect(pos.left).toBeGreaterThanOrEqual(0);
  });

  test("right/left placements flip and clamp on the vertical axis", () => {
    const trigger = { top: 10, left: 500, width: 20, height: 20 };
    const pos = computeFloatingPosition(trigger, PANEL, VIEWPORT, "left");
    // "left" doesn't fit near the left edge-ish trigger.left=500 (500-8-200=292 >= 0, so it DOES
    // fit) — use a trigger flush against the left edge to force the flip to "right".
    const flush = { top: 10, left: 5, width: 20, height: 20 };
    const flipped = computeFloatingPosition(flush, PANEL, VIEWPORT, "left");
    expect(flipped.placement).toBe("right");
    expect(pos.placement).toBe("left");
  });

  test("falls back to the preferred placement when neither side fits", () => {
    const tiny = { width: 1024, height: 50 };
    const trigger = { top: 25, left: 0, width: 10, height: 10 };
    const pos = computeFloatingPosition(trigger, PANEL, tiny, "bottom");
    expect(pos.placement).toBe("bottom");
  });

  test("clamps the main axis too when neither side fits, so it stays on-screen", () => {
    // A viewport far shorter than the panel — neither "bottom" nor its flip "top" fit vertically.
    const tiny = { width: 1024, height: 50 };
    const trigger = { top: 25, left: 100, width: 10, height: 10 };
    const pos = computeFloatingPosition(trigger, PANEL, tiny, "bottom");
    expect(pos.top).toBeGreaterThanOrEqual(0);
    expect(pos.top).toBeLessThanOrEqual(tiny.height);

    // Same for the horizontal pair — neither "left" nor its flip "right" fit horizontally.
    const narrow = { width: 50, height: 768 };
    const sideTrigger = { top: 100, left: 25, width: 10, height: 10 };
    const sidePos = computeFloatingPosition(sideTrigger, PANEL, narrow, "left");
    expect(sidePos.left).toBeGreaterThanOrEqual(0);
    expect(sidePos.left).toBeLessThanOrEqual(narrow.width);
  });
});
