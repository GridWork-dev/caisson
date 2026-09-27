"use client";

import { useLayoutEffect, useState } from "react";
import type { CSSProperties, Ref, RefCallback, RefObject } from "react";

import { computeFloatingPosition, type Placement } from "./position.ts";

/** `position:fixed` + the computed coordinates — typed as `CSSProperties` directly (not a bespoke
 * interface) so it plugs straight into a `style` prop; `radix-ui`'s global type augmentation adds
 * an index signature to `CSSProperties` elsewhere in the dependency graph that a standalone
 * `{position,top,left}` interface wouldn't satisfy. */
export type FloatingStyle = CSSProperties & {
  position: "fixed";
  top: number;
  left: number;
};

/**
 * Measures `triggerRef`/`panelRef` via `getBoundingClientRect` and returns the `position:fixed`
 * style for the panel (via the pure, unit-tested `computeFloatingPosition`), recomputed on open
 * and on scroll (capture-phase, so a scroll inside a nested container is caught too) / resize
 * while open. Returns `null` before the first measurement — callers render the panel
 * `visibility: hidden` while `null` so it is measurable without a positioned-flash (the
 * `useLayoutEffect` commit lands before paint). Shared by Popover/Menu/Tooltip (ADR-0291).
 */
export function useFloatingPosition(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  placement: Placement = "bottom",
): FloatingStyle | null {
  const [style, setStyle] = useState<FloatingStyle | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }
    function measure() {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const panel = panelRef.current?.getBoundingClientRect();
      if (!trigger || !panel) return;
      const pos = computeFloatingPosition(
        trigger,
        { width: panel.width, height: panel.height },
        { width: window.innerWidth, height: window.innerHeight },
        placement,
      );
      setStyle({ position: "fixed", top: pos.top, left: pos.left });
    }
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
    // triggerRef/panelRef are stable ref-object identities across renders — omitted from deps.
  }, [open, placement]);

  return style;
}

/** Merges two refs (callback or object) into one callback ref — used where a component clones a
 * caller-supplied trigger element and must not silently drop a ref the caller already set. */
export function mergeRefs<T>(
  ...refs: readonly (Ref<T> | undefined)[]
): RefCallback<T> {
  return (value: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(value);
      else (ref as RefObject<T | null>).current = value;
    }
  };
}
