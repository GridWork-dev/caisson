"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

import "./reveal.css";

/** Reveal offset axis. Each value names the direction of travel *into* place — the element
 *  starts offset the opposite way and settles to rest. `none` fades with no translate. */
export type RevealDirection = "up" | "down" | "left" | "right" | "none";

export interface RevealProps {
  children: ReactNode;
  /** Polymorphic root tag. Default `div`. */
  as?: "div" | "section" | "li" | "article";
  className?: string;
  /** Per-instance stagger, ms. Applied as `transitionDelay` — map an index over siblings
   *  (`delay={i * 70}`) for a cascading grid. */
  delay?: number;
  /** Which way the element travels into place. Default `up` (rises from below). `none` = fade only.
   *  Drives the pre-reveal offset via the `--cs-reveal-x` / `--cs-reveal-y` custom properties. */
  direction?: RevealDirection;
  /** Offset magnitude in px for the pre-reveal state. Default 12. Ignored when `direction="none"`. */
  distance?: number;
  /** Cascade the DIRECT CHILDREN instead of this element: each child reveals `stagger` ms after
   *  the previous one (via `nth-child` `transition-delay` reading `--cs-reveal-stagger`). Use on a
   *  grid/list wrapper so its cards enter in sequence; the wrapper itself is not hidden. Children
   *  past the 8th share the last step (bounded — raise the ceiling in `reveal.css` if a grid grows).*/
  stagger?: number;
  /** Extra inline styles, merged after the component's own custom-property style (e.g. a grid's
   *  `marginTop`). Lets a Reveal double as a layout container without a wrapping element. */
  style?: CSSProperties;
}

/** Pre-reveal offset (px) per direction — the element starts here and settles to (0,0). */
function offsetFor(
  direction: RevealDirection,
  distance: number,
): [number, number] {
  switch (direction) {
    case "up":
      return [0, distance];
    case "down":
      return [0, -distance];
    case "left":
      return [distance, 0];
    case "right":
      return [-distance, 0];
    case "none":
      return [0, 0];
  }
}

/**
 * Fade-up-once scroll reveal (recipe kit port of the old `apps/site` primitive, ADR-0099).
 *
 *   1. CLIENT — uses `IntersectionObserver` + `useState`/`useEffect`/`useRef`, so `"use client"`.
 *   2. Co-located plain CSS (`reveal.css`) reading only `var(--cs-*)`; the hidden state is gated on
 *      `.cs-js` (the consuming app sets `.cs-js` on `<html>` pre-paint), so with no JS — or before
 *      hydration — content is fully visible. Never a stuck `opacity:0`.
 *   3. `prefers-reduced-motion` honored both in JS (skip the observer, reveal immediately) and in
 *      CSS (the co-located reduced-motion block forces the hidden state visible).
 *
 * Polymorphism here is a fixed tag-name union via `as` (not Radix `Slot`/`asChild`): the element
 * always renders one of a few block-level tags and owns its own internal ref for the observer, so
 * there is no consumer ref to forward.
 */
export function Reveal({
  children,
  as: Tag = "div",
  className,
  delay = 0,
  direction = "up",
  distance = 12,
  stagger,
  style: styleProp,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            obs.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const cls = ["cs-reveal", visible ? "is-visible" : "", className]
    .filter(Boolean)
    .join(" ");
  // Type-narrow the polymorphic tag for the ref without `any`.
  const Component = Tag as "div";
  const [ox, oy] = offsetFor(direction, distance);
  // The offset rides two CSS custom properties the co-located `.cs-reveal` hidden-state rule reads;
  // `delay` is the one dynamic `transitionDelay`. `--cs-reveal-stagger` feeds the child cascade.
  // Cast the record to CSSProperties so the `--cs-*` keys type-check without `any` (React 19
  // permits custom properties in `style`). Consumer `style` merges last.
  const style = {
    "--cs-reveal-x": `${ox}px`,
    "--cs-reveal-y": `${oy}px`,
    ...(stagger ? { "--cs-reveal-stagger": `${stagger}ms` } : {}),
    ...(delay ? { transitionDelay: `${delay}ms` } : {}),
    ...styleProp,
  } as CSSProperties;
  return (
    <Component
      ref={ref as RefObject<HTMLDivElement>}
      className={cls}
      style={style}
      data-stagger={stagger !== undefined ? "" : undefined}
    >
      {children}
    </Component>
  );
}
