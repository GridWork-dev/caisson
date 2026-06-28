"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

// Fade-up-once scroll reveal (V36). The `.cs-reveal` hidden state is gated on `.cs-js` in CSS, so
// with no JS (or before hydration) content is fully visible — progressive enhancement, never a
// stuck `opacity:0`. Respects prefers-reduced-motion via the global.css reduced-motion override.
export function Reveal({
  children,
  as: Tag = "div",
  className,
  delay = 0,
}: {
  children: ReactNode;
  as?: "div" | "section" | "li" | "article";
  className?: string;
  delay?: number;
}) {
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
