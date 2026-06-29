"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import "./reveal.css";

export interface RevealProps {
  children: ReactNode;
  /** Polymorphic root tag. Default `div`. */
  as?: "div" | "section" | "li" | "article";
  className?: string;
  /** Per-instance stagger, ms. Applied as the one dynamic `transitionDelay`. */
  delay?: number;
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
  return (
    <Component
      ref={ref as RefObject<HTMLDivElement>}
      className={cls}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Component>
  );
}
